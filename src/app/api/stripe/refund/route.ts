import { PaymentMethod, Prisma, SaleStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { stripe, moneyToMinorUnits } from "@/lib/stripe";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { positiveQuantity, uuid } from "@/lib/validators";
import { roundMoney } from "@/lib/money";
import { finalizeStripeRefund } from "@/services/stripe-refunds";

const schema = z.object({
  clientRequestId: uuid,
  saleId: uuid,
  mode: z.enum(["REFUND", "CANCEL"]).default("REFUND"),
  reason: z.string().trim().min(10).max(300),
  items: z
    .array(
      z.object({
        saleItemId: uuid,
        quantity: positiveQuantity
      })
    )
    .max(200)
    .default([])
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const actor = await requirePermission("payments.manage");
    const input = schema.parse(await readJson(request));
    const idempotencyKey = `stripe-refund:${input.clientRequestId}`;

    const claim = await db.$transaction(
      async (tx) => {
        const existing = await tx.paymentRefund.findUnique({
          where: { idempotencyKey },
          include: { paymentAttempt: true, refund: true }
        });
        if (existing) {
          if (existing.saleId !== input.saleId || existing.requestedById !== actor.id) {
            throw new ApiError(409, "El identificador de solicitud ya fue utilizado.");
          }
          return { paymentRefund: existing, created: false };
        }

        await tx.$executeRaw`SELECT id FROM sales WHERE id = ${input.saleId}::uuid FOR UPDATE`;
        const inProgress = await tx.paymentRefund.findFirst({
          where: {
            saleId: input.saleId,
            status: { in: ["PENDING", "PROCESSING"] }
          },
          select: { id: true }
        });
        if (inProgress) {
          throw new ApiError(409, "La venta ya tiene una devolución de Stripe en proceso.");
        }

        const sale = await tx.sale.findUnique({
          where: { id: input.saleId },
          include: {
            items: true,
            paymentAttempts: {
              where: { status: "SUCCEEDED" },
              orderBy: { confirmedAt: "desc" },
              take: 1
            }
          }
        });
        if (!sale) throw new ApiError(404, "Venta no encontrada.");
        if (sale.paymentMethod !== PaymentMethod.CARD) {
          throw new ApiError(400, "La venta no fue pagada mediante Stripe.");
        }
        if (
          !([SaleStatus.COMPLETED, SaleStatus.PARTIALLY_REFUNDED] as SaleStatus[]).includes(
            sale.status
          )
        ) {
          throw new ApiError(409, "La venta no admite devoluciones.");
        }
        const attempt = sale.paymentAttempts[0];
        if (!attempt?.chargeId) {
          throw new ApiError(409, "No se encontró el cargo confirmado de Stripe.");
        }

        const previous = await tx.refundItem.groupBy({
          by: ["saleItemId"],
          where: { saleItemId: { in: sale.items.map((item) => item.id) } },
          _sum: { quantity: true, amount: true }
        });
        const previousMap = new Map(
          previous.map((item) => [
            item.saleItemId,
            {
              quantity: item._sum.quantity || Number(0),
              amount: item._sum.amount || Number(0)
            }
          ])
        );
        const saleItemMap = new Map(sale.items.map((item) => [item.id, item]));
        const requested =
          input.mode === "CANCEL"
            ? sale.items
                .map((item) => ({
                  saleItemId: item.id,
                  quantity: (item.quantity - 
                    (previousMap.get(item.id)?.quantity || 0)
                  )
                }))
                .filter((item) => (item.quantity > 0))
            : input.items.map((item) => ({
                saleItemId: item.saleItemId,
                quantity: Number(item.quantity)
              }));
        if (!requested.length) {
          throw new ApiError(400, "Selecciona al menos una partida para reembolsar.");
        }
        if (new Set(requested.map((item) => item.saleItemId)).size !== requested.length) {
          throw new ApiError(400, "No repitas partidas en el reembolso.");
        }

        const requestedItems = requested.map((requestedItem) => {
          const item = saleItemMap.get(requestedItem.saleItemId);
          if (!item) throw new ApiError(400, "Una partida no pertenece a la venta.");
          const prior = previousMap.get(item.id) || {
            quantity: 0,
            amount: new Prisma.Decimal(0)
          };
          if ((prior.quantity + requestedItem.quantity) > item.quantity) {
            throw new ApiError(409, `El reembolso de ${item.nameSnapshot} supera lo vendido.`);
          }
          const amount = (prior.quantity + requestedItem.quantity) >= item.quantity
            ? roundMoney(item.lineTotal.minus(prior.amount))
            : roundMoney(item.lineTotal.div(item.quantity).mul(requestedItem.quantity));
          if (amount.lte(0)) {
            throw new ApiError(409, `El importe reembolsable de ${item.nameSnapshot} ya fue agotado.`);
          }
          return {
            saleItemId: item.id,
            quantity: requestedItem.quantity,
            amount: amount
          };
        });
        const amount = roundMoney(
          requestedItems.reduce(
            (sum, item) => sum.plus(item.amount),
            new Prisma.Decimal(0)
          )
        );
        const paymentRefund = await tx.paymentRefund.create({
          data: {
            paymentAttemptId: attempt.id,
            saleId: sale.id,
            amount,
            currency: attempt.currency,
            status: "PENDING",
            requestedById: actor.id,
            reason: sanitizeText(input.reason, 300),
            mode: input.mode,
            requestedItems,
            idempotencyKey
          },
          include: { paymentAttempt: true, refund: true }
        });
        await tx.auditLog.create({
          data: {
            userId: actor.id,
            action: "STRIPE_REFUND_REQUESTED",
            entityType: "Sale",
            entityId: sale.id,
            metadata: { paymentRefundId: paymentRefund.id, amount: amount.toString() }
          }
        });
        return { paymentRefund, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (claim.paymentRefund.refund) {
      return jsonOk({
        status: "SUCCEEDED",
        refundId: claim.paymentRefund.refund.id
      });
    }
    const chargeId = claim.paymentRefund.paymentAttempt.chargeId;
    if (!chargeId) throw new ApiError(409, "El cargo de Stripe no está disponible.");

    let providerRefund;
    try {
      providerRefund = await stripe.refunds.create(
        {
          charge: chargeId,
          amount: moneyToMinorUnits(
            claim.paymentRefund.amount,
            claim.paymentRefund.currency.toLowerCase()
          ),
          reason: "requested_by_customer",
          metadata: {
            paymentRefundId: claim.paymentRefund.id,
            saleId: input.saleId
          }
        },
        { idempotencyKey: `refund:${claim.paymentRefund.id}` }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe no respondió.";
      await db.paymentRefund.update({
        where: { id: claim.paymentRefund.id },
        data: { error: message.slice(0, 500) }
      });
      throw new ApiError(
        502,
        "Stripe no pudo confirmar la devolución. Puedes reintentar la misma solicitud.",
        "STRIPE_REFUND_UNAVAILABLE"
      );
    }

    if (providerRefund.status === "pending") {
      await db.paymentRefund.update({
        where: { id: claim.paymentRefund.id },
        data: {
          status: "PROCESSING",
          stripeRefundId: providerRefund.id,
          error: null
        }
      });
      return jsonOk(
        { status: "PROCESSING", paymentRefundId: claim.paymentRefund.id },
        202
      );
    }
    if (providerRefund.status !== "succeeded") {
      await db.paymentRefund.update({
        where: { id: claim.paymentRefund.id },
        data: {
          status: "FAILED",
          stripeRefundId: providerRefund.id,
          error: `Stripe devolvió estado ${providerRefund.status}`
        }
      });
      throw new ApiError(409, "Stripe rechazó la devolución.", "STRIPE_REFUND_FAILED");
    }

    await db.paymentRefund.update({
      where: { id: claim.paymentRefund.id },
      data: {
        status: "PROCESSING",
        stripeRefundId: providerRefund.id,
        error: null
      }
    });
    const refund = await finalizeStripeRefund(
      claim.paymentRefund.id,
      providerRefund.id
    );
    return jsonOk({ status: "SUCCEEDED", refundId: refund.id });
  } catch (error) {
    return jsonError(error);
  }
}
