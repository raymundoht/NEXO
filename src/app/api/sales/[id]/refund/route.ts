import {
  PaymentMethod,
  Prisma,
  SaleStatus
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import {
  cardAuthorization,
  positiveQuantity,
  uuid
} from "@/lib/validators";
import { roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";

const schema = z.object({
  clientRequestId: uuid,
  mode: z.enum(["REFUND", "CANCEL"]).default("REFUND"),
  reason: z.string().trim().min(10).max(300),
  cashSessionId: uuid.optional(),
  authorizationCode: cardAuthorization.optional(),
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

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const user = await requirePermission(
      input.mode === "CANCEL" ? "sales.cancel" : "sales.refund"
    );

    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.refund.findUnique({
          where: { clientRequestId: input.clientRequestId },
          include: { items: true }
        });
        if (existing) {
          if (existing.saleId !== id || existing.approvedById !== user.id) {
            throw new ApiError(409, "El identificador de solicitud ya fue utilizado.");
          }
          return { refund: existing, created: false };
        }
        const [sale, settings] = await Promise.all([
          tx.sale.findUnique({
            where: { id },
            include: { items: { include: { product: true } } }
          }),
          tx.businessSettings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {}
          })
        ]);
        if (!sale) throw new ApiError(404, "Venta no encontrada.");
        if (
          !([
            SaleStatus.COMPLETED,
            SaleStatus.PARTIALLY_REFUNDED
          ] as SaleStatus[]).includes(
            sale.status
          )
        ) {
          throw new ApiError(
            409,
            input.mode === "CANCEL"
              ? "La venta no admite cancelación."
              : "La venta no admite reembolsos."
          );
        }
        
        if (sale.paymentMethod === PaymentMethod.CARD) {
          throw new ApiError(400, "Esta venta se pagó con tarjeta. Debes reembolsarla a través de Stripe.");
        }

        const lineMap = new Map(sale.items.map((line) => [line.id, line]));
        const previous = await tx.refundItem.groupBy({
          by: ["saleItemId"],
          where: { saleItemId: { in: sale.items.map((line) => line.id) } },
          _sum: { quantity: true, amount: true }
        });
        const previousMap = new Map(
          previous.map((item) => [
            item.saleItemId,
            {
              quantity: Number(item._sum.quantity || 0),
              amount: item._sum.amount ?? new Prisma.Decimal(0)
            }
          ])
        );
        const requestedItems =
          input.mode === "CANCEL"
            ? sale.items
                .map((line) => ({
                  saleItemId: line.id,
                  quantity: line.quantity.minus(previousMap.get(line.id)?.quantity || 0)
                }))
                .filter((line) => line.quantity.gt(0))
            : input.items.map((item) => ({
                saleItemId: item.saleItemId,
                quantity: Number(item.quantity)
              }));
        if (!requestedItems.length) {
          throw new ApiError(
            400,
            input.mode === "CANCEL"
              ? "La venta ya no tiene partidas pendientes por cancelar."
              : "Selecciona al menos una partida para reembolsar."
          );
        }
        const requestedIds = requestedItems.map((item) => item.saleItemId);
        if (new Set(requestedIds).size !== requestedIds.length) {
          throw new ApiError(400, "No repitas partidas en el reembolso.");
        }
        const refundLines = requestedItems.map((item) => {
          const line = lineMap.get(item.saleItemId);
          if (!line) {
            throw new ApiError(400, "Una partida no pertenece a la venta.");
          }
          const quantity = Number(item.quantity);
          const previousRefund = previousMap.get(line.id) || {
            quantity: 0,
            amount: new Prisma.Decimal(0)
          };
          const alreadyRefunded = previousRefund.quantity;
          if ((new Prisma.Decimal(alreadyRefunded).plus(quantity)).gt(line.quantity)) {
            throw new ApiError(
              409,
              `El reembolso de ${line.nameSnapshot} supera lo vendido.`
            );
          }
          const amount = (new Prisma.Decimal(alreadyRefunded).plus(quantity)).gte(line.quantity)
            ? roundMoney(line.lineTotal.minus(previousRefund.amount))
            : roundMoney(line.lineTotal.div(line.quantity).mul(quantity));
          if (amount.lte(0)) {
            throw new ApiError(409, `El importe reembolsable de ${line.nameSnapshot} ya fue agotado.`);
          }
          return { line, quantity, amount };
        });
        const amount = roundMoney(
          refundLines.reduce(
            (total, line) => total.plus(line.amount),
            new Prisma.Decimal(0)
          )
        );

        let cashSession: Awaited<
          ReturnType<typeof tx.cashSession.findFirst>
        > = null;
        if (sale.paymentMethod === PaymentMethod.CASH) {
          if (!input.cashSessionId) {
            throw new ApiError(
              400,
              "Selecciona una sesión de caja abierta para entregar el reembolso."
            );
          }
          await tx.$executeRaw`SELECT id FROM cash_sessions WHERE id = ${input.cashSessionId}::uuid FOR UPDATE`;
          cashSession = await tx.cashSession.findFirst({
            where: { id: input.cashSessionId, status: "OPEN" }
          });
          if (!cashSession) {
            throw new ApiError(409, "La sesión de caja no está abierta.");
          }
        } else if (!input.authorizationCode) {
          throw new ApiError(
            400,
            "Captura la autorización del reembolso en la terminal."
          );
        }

        const folio = await nextFolio(tx, "REFUND", "DEV");
        const created = await tx.refund.create({
          data: {
            clientRequestId: input.clientRequestId,
            folio,
            saleId: sale.id,
            approvedById: user.id,
            amount,
            reason: sanitizeText(input.reason, 300),
            authorizationCode: input.authorizationCode || null,
            items: {
              create: refundLines.map(({ line, quantity, amount: lineAmount }) => ({
                saleItemId: line.id,
                productId: line.productId,
                quantity,
                amount: lineAmount
              }))
            }
          },
          include: { items: true }
        });

        for (const { line, quantity } of refundLines) {
          const stockBefore = line.product.currentStock;
          const stockAfter = (stockBefore.plus(quantity));
          const storeStockBefore = line.product.storeStock;
          const storeStockAfter = (storeStockBefore.plus(quantity));
          const updated = await tx.product.updateMany({
            where: {
              id: line.productId,
              currentStock: stockBefore,
              storeStock: storeStockBefore
            },
            data: { 
              currentStock: stockAfter,
              storeStock: storeStockAfter
            }
          });
          if (updated.count !== 1) {
            throw new ApiError(
              409,
              `Las existencias de ${line.nameSnapshot} cambiaron. Intenta de nuevo.`
            );
          }
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              userId: user.id,
              type: "REFUND",
              quantity,
              stockBefore,
              stockAfter,
              unitCost: line.unitCostSnapshot,
              referenceType: "Refund",
              referenceId: created.id,
              idempotencyKey: `${input.clientRequestId}:${line.id}`,
              reason: `Reembolso ${folio} de ${sale.folio}`
            }
          });
        }

        if (cashSession) {
          const baseAmount =
            cashSession.currency === sale.currency
              ? amount
              : cashSession.currency === settings.baseCurrency
                ? roundMoney(amount.mul(sale.exchangeRate))
                : null;
          if (!baseAmount) {
            throw new ApiError(
              400,
              "La moneda de la caja no es compatible con el reembolso."
            );
          }
          await tx.cashMovement.create({
            data: {
              cashSessionId: cashSession.id,
              userId: user.id,
              type: "REFUND",
              amount: (-baseAmount),
              currency: cashSession.currency,
              referenceType: "Refund",
              referenceId: created.id,
              idempotencyKey: `refund:${input.clientRequestId}`,
              notes: `Reembolso ${folio} de ${sale.folio}`
            }
          });
        }

        const allRefunded = sale.items.every((line) => {
          const priorQuantity = previousMap.get(line.id)?.quantity || 0;
          const prior = new Prisma.Decimal(priorQuantity);
          const currentQuantity = refundLines.find((item) => item.line.id === line.id)?.quantity || 0;
          const current = new Prisma.Decimal(currentQuantity);
          return prior.plus(current).gte(line.quantity);
        });
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status:
              input.mode === "CANCEL"
                ? SaleStatus.CANCELLED
                : allRefunded
                  ? SaleStatus.REFUNDED
                  : SaleStatus.PARTIALLY_REFUNDED
          }
        });
        return { refund: created, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const refund = result.refund;

    if (result.created) {
      const metadata = await requestMetadata();
      await audit({
        userId: user.id,
        action: input.mode === "CANCEL" ? "SALE_CANCELLED" : "SALE_REFUNDED",
        entityType: "Refund",
        entityId: refund.id,
        ip: metadata.ip,
        metadata: {
          saleId: id,
          folio: refund.folio,
          amount: refund.amount.toString(),
          mode: input.mode
        }
      });
    }
    return jsonOk(refund, result.created ? 201 : 200);
  } catch (error) {
    return jsonError(error);
  }
}
