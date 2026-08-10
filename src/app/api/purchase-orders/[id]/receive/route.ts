import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { positiveQuantity, uuid } from "@/lib/validators";
import { decimal, roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";

const schema = z.object({
  supplierDocument: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: uuid,
        quantity: positiveQuantity,
        unitCost: z.coerce.number().min(0).max(1_000_000_000)
      })
    )
    .min(1)
    .max(500)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("purchases.receive");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const lineIds = input.items.map((item) => item.purchaseOrderItemId);
    if (new Set(lineIds).size !== lineIds.length) {
      throw new ApiError(400, "No repitas partidas en la recepción.");
    }

    const receipt = await db.$transaction(
      async (tx) => {
        const order = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { items: { include: { product: true } } }
        });
        if (!order) throw new ApiError(404, "Orden de compra no encontrada.");
        if (
          !([
            PurchaseOrderStatus.SENT,
            PurchaseOrderStatus.PARTIALLY_RECEIVED
          ] as PurchaseOrderStatus[]).includes(order.status)
        ) {
          throw new ApiError(
            409,
            "La orden no está disponible para recepción."
          );
        }

        const orderLineMap = new Map(order.items.map((line) => [line.id, line]));
        for (const item of input.items) {
          const line = orderLineMap.get(item.purchaseOrderItemId);
          if (!line) {
            throw new ApiError(400, "Una partida no pertenece a esta orden.");
          }
          const quantity = decimal(item.quantity);
          const remaining = line.quantityOrdered.minus(line.quantityReceived);
          if (quantity.gt(remaining)) {
            throw new ApiError(
              409,
              `La recepción de ${line.product.name} supera lo pendiente.`
            );
          }
          if (!decimal(item.unitCost).equals(line.unitCost)) {
            throw new ApiError(
              409,
              `El costo recibido de ${line.product.name} no coincide con la orden.`
            );
          }
        }

        const receiptNumber = await nextFolio(tx, "PURCHASE_RECEIPT", "REC");
        const created = await tx.purchaseReceipt.create({
          data: {
            receiptNumber,
            purchaseOrderId: order.id,
            receivedById: user.id,
            supplierDocument: input.supplierDocument || null,
            notes: input.notes ? sanitizeText(input.notes, 2000) : null,
            items: {
              create: input.items.map((item) => {
                const line = orderLineMap.get(item.purchaseOrderItemId)!;
                return {
                  purchaseOrderItemId: line.id,
                  productId: line.productId,
                  quantity: decimal(item.quantity),
                  unitCost: line.unitCost
                };
              })
            }
          },
          include: { items: true }
        });

        for (const item of input.items) {
          const line = orderLineMap.get(item.purchaseOrderItemId)!;
          const quantity = decimal(item.quantity);
          const stockBefore = line.product.currentStock;
          const stockAfter = stockBefore.plus(quantity);
          const valuedCurrentStock = Prisma.Decimal.max(stockBefore, 0);
          const denominator = valuedCurrentStock.plus(quantity);
          const averageCost = denominator.gt(0)
            ? roundMoney(
                valuedCurrentStock
                  .mul(line.product.cost)
                  .plus(quantity.mul(line.unitCost))
                  .div(denominator)
              )
            : line.unitCost;

          await tx.purchaseOrderItem.update({
            where: { id: line.id },
            data: { quantityReceived: { increment: quantity } }
          });
          await tx.product.update({
            where: { id: line.productId },
            data: { currentStock: stockAfter, cost: averageCost }
          });
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              userId: user.id,
              type: "PURCHASE_RECEIPT",
              quantity,
              stockBefore,
              stockAfter,
              unitCost: line.unitCost,
              referenceType: "PurchaseReceipt",
              referenceId: created.id,
              reason: `Recepción ${receiptNumber}`
            }
          });
          await tx.supplierProduct.upsert({
            where: {
              supplierId_productId: {
                supplierId: order.supplierId,
                productId: line.productId
              }
            },
            create: {
              supplierId: order.supplierId,
              productId: line.productId,
              referenceCost: line.unitCost,
              currency: order.currency
            },
            update: {
              referenceCost: line.unitCost,
              currency: order.currency
            }
          });
        }

        const refreshedLines = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: order.id }
        });
        const complete = refreshedLines.every((line) =>
          line.quantityReceived.gte(line.quantityOrdered)
        );
        await tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            status: complete
              ? PurchaseOrderStatus.RECEIVED
              : PurchaseOrderStatus.PARTIALLY_RECEIVED
          }
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "PURCHASE_RECEIVED",
      entityType: "PurchaseReceipt",
      entityId: receipt.id,
      ip: metadata.ip,
      metadata: { receiptNumber: receipt.receiptNumber, purchaseOrderId: id }
    });
    return jsonOk(receipt, 201);
  } catch (error) {
    return jsonError(error);
  }
}
