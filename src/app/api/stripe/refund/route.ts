import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const refundSchema = z.object({
  saleId: z.string().uuid(),
  reason: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const actor = await requirePermission("sales.refund");
    const input = refundSchema.parse(await readJson(request));

    let paymentRefundId = "";
    let chargeId = "";
    let expectedMinor = 0;
    
    let retries = 3;
    while (retries > 0) {
      try {
        const result = await db.$transaction(async (tx) => {
          const attempt = await tx.paymentAttempt.findFirst({
            where: { saleId: input.saleId, status: 'SUCCEEDED' }
          });

          if (!attempt || !attempt.chargeId) {
            throw new ApiError(400, "La venta no tiene un pago con tarjeta exitoso.");
          }

          const existingRefund = await tx.paymentRefund.findFirst({
            where: { saleId: input.saleId, status: { in: ['PENDING', 'PROCESSING', 'SUCCEEDED'] } }
          });

          if (existingRefund) {
            throw new ApiError(409, "Ya existe un reembolso en proceso o completado para esta venta.");
          }

          const newRefund = await tx.paymentRefund.create({
            data: {
              paymentAttemptId: attempt.id,
              saleId: input.saleId,
              amount: attempt.expectedAmount,
              currency: attempt.currency,
              status: 'PENDING',
              requestedById: actor.id,
              reason: input.reason || "Reembolso solicitado",
              idempotencyKey: `refund_${input.saleId}_${Date.now()}`
            }
          });

          await tx.auditLog.create({
            data: {
              userId: actor.id,
              action: 'STRIPE_REFUND_REQUESTED',
              entityType: 'Sale',
              entityId: attempt.saleId,
              metadata: { attemptId: attempt.id, refundId: newRefund.id }
            }
          });

          return { refund: newRefund, attempt };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        paymentRefundId = result.refund.id;
        chargeId = result.attempt.chargeId!;
        expectedMinor = Math.round(Number(result.attempt.expectedAmount) * 100);
        break;

      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 100));
            continue;
          }
        }
        throw err;
      }
    }

    // Call Stripe
    try {
      const stripeRefund = await stripe.refunds.create({
        charge: chargeId,
        amount: expectedMinor,
        reason: 'requested_by_customer',
        metadata: {
           paymentRefundId: paymentRefundId,
           saleId: input.saleId
        }
      }, { idempotencyKey: `refund-${paymentRefundId}` });

      // Update locally
      await db.paymentRefund.update({
        where: { id: paymentRefundId },
        data: {
           status: stripeRefund.status === 'succeeded' ? 'SUCCEEDED' : (stripeRefund.status === 'pending' ? 'PROCESSING' : 'FAILED'),
           stripeRefundId: stripeRefund.id
        }
      });
      
      return jsonOk({ success: true, refundId: paymentRefundId });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.paymentRefund.update({
        where: { id: paymentRefundId },
        data: {
           status: 'FAILED',
           error: msg.slice(0, 500)
        }
      });
      throw new ApiError(500, `Error en Stripe: ${msg}`);
    }

  } catch (error) {
    return jsonError(error);
  }
}
