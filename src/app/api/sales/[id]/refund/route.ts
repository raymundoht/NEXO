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
import { decimal, roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";

const schema = z.object({
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

    const refund = await db.$transaction(
      async (tx) => {
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
          _sum: { quantity: true }
        });
        const previousMap = new Map(
          previous.map((item) => [
            item.saleItemId,
            item._sum.quantity || decimal(0)
          ])
        );
        const requestedItems =
          input.mode === "CANCEL"
            ? sale.items
                .map((line) => ({
                  saleItemId: line.id,
                  quantity: line.quantity.minus(
                    previousMap.get(line.id) || decimal(0)
                  )
                }))
                .filter((line) => line.quantity.gt(0))
            : input.items.map((item) => ({
                saleItemId: item.saleItemId,
                quantity: decimal(item.quantity)
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
          const quantity = decimal(item.quantity);
          const alreadyRefunded =
            previousMap.get(line.id) || decimal(0);
          if (alreadyRefunded.plus(quantity).gt(line.quantity)) {
            throw new ApiError(
              409,
              `El reembolso de ${line.nameSnapshot} supera lo vendido.`
            );
          }
          const amount = roundMoney(
            line.lineTotal.div(line.quantity).mul(quantity)
          );
          return { line, quantity, amount };
        });
        const amount = roundMoney(
          refundLines.reduce(
            (total, line) => total.plus(line.amount),
            decimal(0)
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
          const stockAfter = stockBefore.plus(quantity);
          const updated = await tx.product.updateMany({
            where: {
              id: line.productId,
              currentStock: stockBefore
            },
            data: { currentStock: stockAfter }
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
              unitCost: line.product.cost,
              referenceType: "Refund",
              referenceId: created.id,
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
              amount: baseAmount.negated(),
              currency: cashSession.currency,
              referenceType: "Refund",
              referenceId: created.id,
              notes: `Reembolso ${folio} de ${sale.folio}`
            }
          });
        }

        const allRefunded = sale.items.every((line) => {
          const prior =
            previousMap.get(line.id) || decimal(0);
          const current =
            refundLines.find((item) => item.line.id === line.id)?.quantity ||
            decimal(0);
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
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

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
    return jsonOk(refund, 201);
  } catch (error) {
    return jsonError(error);
  }
}
