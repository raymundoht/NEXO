import { Prisma, SaleStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";

const requestedItemsSchema = z.array(
  z.object({
    saleItemId: z.string().uuid(),
    quantity: z.string(),
    amount: z.string()
  })
);

export async function finalizeStripeRefund(
  paymentRefundId: string,
  stripeRefundId: string
) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM payment_refunds WHERE id = ${paymentRefundId}::uuid FOR UPDATE`;
      const header = await tx.paymentRefund.findUnique({
        where: { id: paymentRefundId },
        select: { saleId: true }
      });
      if (!header) throw new ApiError(404, "Solicitud de reembolso no encontrada.");

      await tx.$executeRaw`SELECT id FROM sales WHERE id = ${header.saleId}::uuid FOR UPDATE`;
      const paymentRefund = await tx.paymentRefund.findUnique({
        where: { id: paymentRefundId },
        include: {
          refund: true,
          sale: { include: { items: true } }
        }
      });
      if (!paymentRefund) {
        throw new ApiError(404, "Solicitud de reembolso no encontrada.");
      }
      if (paymentRefund.refund) return paymentRefund.refund;
      if (
        paymentRefund.stripeRefundId &&
        paymentRefund.stripeRefundId !== stripeRefundId
      ) {
        throw new ApiError(409, "La devolución de Stripe no coincide con la solicitud.");
      }

      const requestedItems = requestedItemsSchema.parse(
        paymentRefund.requestedItems
      );
      const saleItemMap = new Map(
        paymentRefund.sale.items.map((item) => [item.id, item])
      );
      const previous = await tx.refundItem.groupBy({
        by: ["saleItemId"],
        where: { saleItemId: { in: paymentRefund.sale.items.map((item) => item.id) } },
        _sum: { quantity: true }
      });
      const previousMap = new Map(
        previous.map((item) => [
          item.saleItemId,
          item._sum.quantity || Number(0)
        ])
      );

      const lines = requestedItems.map((requested) => {
        const line = saleItemMap.get(requested.saleItemId);
        if (!line) throw new ApiError(409, "Una partida ya no pertenece a la venta.");
        const quantity = Number(requested.quantity);
        const amount = Number(requested.amount);
        const prior = previousMap.get(line.id) || 0;
        if (quantity <= 0 || amount <= 0 || (new Prisma.Decimal(prior).plus(quantity)).gt(line.quantity)) {
          throw new ApiError(409, `La devolución de ${line.nameSnapshot} ya no es válida.`);
        }
        return { line, quantity, amount };
      });
      const total = lines.reduce(
        (sum, line) => (sum + line.amount),
        Number(0)
      );
      if (total !== Number(paymentRefund.amount)) {
        throw new ApiError(409, "El importe local no coincide con la devolución de Stripe.");
      }

      const productIds = [...new Set(lines.map(({ line }) => line.productId))].sort();
      for (const productId of productIds) {
        await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      }
      const products = await tx.product.findMany({
        where: { id: { in: productIds } }
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      const folio = await nextFolio(tx, "REFUND", "DEV");
      const requestIdCandidate = paymentRefund.idempotencyKey.replace(
        /^stripe-refund:/,
        ""
      );
      const requestUuid = z.string().uuid().safeParse(requestIdCandidate).success
        ? requestIdCandidate
        : paymentRefund.id;
      const refund = await tx.refund.create({
        data: {
          clientRequestId: requestUuid,
          folio,
          saleId: paymentRefund.saleId,
          approvedById: paymentRefund.requestedById,
          amount: paymentRefund.amount,
          reason: paymentRefund.reason,
          authorizationCode: stripeRefundId,
          items: {
            create: lines.map(({ line, quantity, amount }) => ({
              saleItemId: line.id,
              productId: line.productId,
              quantity,
              amount
            }))
          }
        },
        include: { items: true }
      });

      for (const { line, quantity } of lines) {
        const product = productMap.get(line.productId);
        if (!product) throw new ApiError(404, "Producto del reembolso no encontrado.");
        const stockAfter = product.currentStock.plus(quantity);
        const updated = await tx.product.updateMany({
          where: { id: product.id, currentStock: product.currentStock },
          data: { currentStock: stockAfter }
        });
        if (updated.count !== 1) {
          throw new ApiError(409, `Las existencias de ${line.nameSnapshot} cambiaron.`);
        }
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            userId: paymentRefund.requestedById,
            type: "REFUND",
            quantity,
            stockBefore: product.currentStock,
            stockAfter,
            unitCost: line.unitCostSnapshot,
            referenceType: "Refund",
            referenceId: refund.id,
            idempotencyKey: `stripe-refund:${paymentRefund.id}:${line.id}`,
            reason: `Reembolso Stripe ${folio} de ${paymentRefund.sale.folio}`
          }
        });
        product.currentStock = stockAfter;
      }

      const allRefunded = paymentRefund.sale.items.every((item) => {
        const prior = previousMap.get(item.id) || 0;
        const current =
          lines.find(({ line }) => line.id === item.id)?.quantity || 0;
        return (new Prisma.Decimal(prior).plus(current)).gte(item.quantity);
      });
      await tx.sale.update({
        where: { id: paymentRefund.saleId },
        data: {
          status:
            paymentRefund.mode === "CANCEL" && allRefunded
              ? SaleStatus.CANCELLED
              : allRefunded
                ? SaleStatus.REFUNDED
                : SaleStatus.PARTIALLY_REFUNDED
        }
      });
      await tx.paymentRefund.update({
        where: { id: paymentRefund.id },
        data: {
          refundId: refund.id,
          stripeRefundId,
          status: "SUCCEEDED",
          processedAt: new Date(),
          error: null
        }
      });
      await tx.auditLog.create({
        data: {
          userId: paymentRefund.requestedById,
          action: "STRIPE_REFUND_SUCCEEDED",
          entityType: "Refund",
          entityId: refund.id,
          metadata: {
            saleId: paymentRefund.saleId,
            paymentRefundId: paymentRefund.id,
            stripeRefundId,
            amount: paymentRefund.amount.toString()
          }
        }
      });
      return refund;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
