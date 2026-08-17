import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { stripe, moneyToMinorUnits } from "@/lib/stripe";
import { fulfillSaleOnce } from "@/services/sales";
import { finalizeStripeRefund } from "@/services/stripe-refunds";

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("payments.manage");

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60_000);
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const attempts = await db.paymentAttempt.findMany({
      where: {
        OR: [
          {
            status: { in: ["PENDING", "PROCESSING"] },
            createdAt: { lt: thirtyMinutesAgo }
          },
          { status: "REVIEW_REQUIRED", updatedAt: { lt: oneMinuteAgo } }
        ]
      },
      orderBy: { updatedAt: "asc" },
      take: 20
    });
    const attemptResults: Array<Record<string, unknown>> = [];

    for (const attempt of attempts) {
      try {
        if (!attempt.checkoutSessionId) {
          await expireAttempt(attempt.id);
          attemptResults.push({ id: attempt.id, action: "FAILED_CREATION" });
          continue;
        }
        const session = await stripe.checkout.sessions.retrieve(
          attempt.checkoutSessionId,
          { expand: ["payment_intent"] }
        );
        if (
          session.payment_status === "paid" &&
          session.mode === "payment" &&
          session.livemode === false
        ) {
          const intentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
          const latestCharge =
            typeof session.payment_intent !== "string"
              ? session.payment_intent?.latest_charge
              : null;
          const chargeId =
            typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
          if (!intentId || session.amount_total == null) {
            throw new Error("Stripe no devolvió los datos completos del pago.");
          }
          await fulfillSaleOnce(
            session.id,
            intentId,
            chargeId || null,
            session.amount_total
          );
          const refreshed = await db.paymentAttempt.findUnique({
            where: { id: attempt.id },
            select: { status: true }
          });
          attemptResults.push({
            id: attempt.id,
            action: refreshed?.status || "NOT_FOUND"
          });
        } else if (
          session.status === "expired" ||
          (session.status === "complete" && session.payment_status === "unpaid")
        ) {
          await expireAttempt(attempt.id);
          attemptResults.push({ id: attempt.id, action: "EXPIRED" });
        } else {
          attemptResults.push({ id: attempt.id, action: "STILL_OPEN" });
        }
      } catch (error) {
        attemptResults.push({
          id: attempt.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const pendingRefunds = await db.paymentRefund.findMany({
      where: {
        status: { in: ["PENDING", "PROCESSING"] },
        updatedAt: { lt: oneMinuteAgo }
      },
      include: { paymentAttempt: true },
      orderBy: { updatedAt: "asc" },
      take: 20
    });
    const refundResults: Array<Record<string, unknown>> = [];
    for (const local of pendingRefunds) {
      try {
        let providerRefund;
        if (local.stripeRefundId) {
          providerRefund = await stripe.refunds.retrieve(local.stripeRefundId);
        } else {
          if (!local.paymentAttempt.chargeId) {
            throw new Error("El intento no tiene un cargo de Stripe asociado.");
          }
          providerRefund = await stripe.refunds.create(
            {
              charge: local.paymentAttempt.chargeId,
              amount: moneyToMinorUnits(local.amount, local.currency),
              reason: "requested_by_customer",
              metadata: {
                paymentRefundId: local.id,
                saleId: local.saleId
              }
            },
            { idempotencyKey: `refund:${local.id}` }
          );
          await db.paymentRefund.update({
            where: { id: local.id },
            data: { stripeRefundId: providerRefund.id, status: "PROCESSING" }
          });
        }

        if (providerRefund.status === "succeeded") {
          const refund = await finalizeStripeRefund(local.id, providerRefund.id);
          refundResults.push({ id: local.id, action: "SUCCEEDED", refundId: refund.id });
        } else if (
          providerRefund.status === "failed" ||
          providerRefund.status === "canceled"
        ) {
          await db.paymentRefund.update({
            where: { id: local.id },
            data: {
              status: "FAILED",
              error: `Stripe devolvió estado ${providerRefund.status}`
            }
          });
          refundResults.push({ id: local.id, action: "FAILED" });
        } else {
          refundResults.push({ id: local.id, action: "PROCESSING" });
        }
      } catch (error) {
        refundResults.push({
          id: local.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return jsonOk({
      attempts: { processed: attempts.length, results: attemptResults },
      refunds: { processed: pendingRefunds.length, results: refundResults }
    });
  } catch (error) {
    return jsonError(error);
  }
}

async function expireAttempt(attemptId: string) {
  let retries = 3;
  while (retries > 0) {
    try {
      await db.$transaction(
        async (tx) => {
          const attempt = await tx.paymentAttempt.findUnique({
            where: { id: attemptId }
          });
          if (!attempt || !["PENDING", "PROCESSING"].includes(attempt.status)) {
            return;
          }
          await tx.stockReservation.updateMany({
            where: {
              paymentAttemptId: attemptId,
              consumedAt: null,
              releasedAt: null
            },
            data: { releasedAt: new Date() }
          });
          await tx.paymentAttempt.update({
            where: { id: attemptId },
            data: { status: "EXPIRED" }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        retries > 1
      ) {
        retries -= 1;
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }
      throw error;
    }
  }
}
