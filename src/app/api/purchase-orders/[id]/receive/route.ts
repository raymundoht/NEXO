import { Prisma, PurchaseOrderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { positiveQuantity, uuid } from "@/lib/validators";
import { roundCost } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";

const schema = z.object({
  clientRequestId: uuid,
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

    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.purchaseReceipt.findUnique({
          where: { clientRequestId: input.clientRequestId },
          include: { items: true }
        });
        if (existing) {
          if (existing.purchaseOrderId !== id) {
            throw new ApiError(409, "El identificador de solicitud ya fue utilizado.");
          }
          return { receipt: existing, created: false };
        }

        await tx.$executeRaw`SELECT id FROM purchase_orders WHERE id = ${id}::uuid FOR UPDATE`;
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

        const settings = await tx.businessSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {}
        });

        const orderLineMap = new Map(order.items.map((line) => [line.id, line]));
        for (const item of input.items) {
          const line = orderLineMap.get(item.purchaseOrderItemId);
          if (!line) {
            throw new ApiError(400, "Una partida no pertenece a esta orden.");
          }
          const quantity = new Prisma.Decimal(item.quantity);
          const remaining = line.quantityOrdered.minus(line.quantityReceived);
          if (quantity.gt(remaining)) {
            throw new ApiError(
              409,
              `La recepción de ${line.product.name} supera lo pendiente.`
            );
          }
          if (!roundCost(new Prisma.Decimal(item.unitCost)).equals(line.unitCost)) {
            throw new ApiError(
              409,
              `El costo recibido de ${line.product.name} no coincide con la orden.`
            );
          }
        }

        // Validate supplier allocation quotas
        for (const item of input.items) {
          const line = orderLineMap.get(item.purchaseOrderItemId)!;
          const supplierProduct = await tx.supplierProduct.findUnique({
            where: {
              supplierId_productId: {
                supplierId: order.supplierId,
                productId: line.productId
              }
            }
          });
          if (supplierProduct?.allocatedQty != null) {
            const received = await tx.purchaseReceiptItem.aggregate({
              where: {
                productId: line.productId,
                receipt: {
                  purchaseOrder: { supplierId: order.supplierId }
                }
              },
              _sum: { quantity: true }
            });
            const totalReceived = new Prisma.Decimal(received._sum.quantity ?? 0);
            const newQuantity = new Prisma.Decimal(item.quantity);
            const wouldBeTotal = totalReceived.plus(newQuantity);
            if (wouldBeTotal.gt(supplierProduct.allocatedQty ?? 0)) {
              const available = new Prisma.Decimal(supplierProduct.allocatedQty ?? 0).minus(totalReceived);
              const availableStr = available.isNegative() ? "0" : available.toString();
              throw new ApiError(
                409,
                `La recepción de ${line.product.name} excede la cuota asignada por el proveedor. Disponible: ${availableStr}, intentando recibir: ${newQuantity.toString()}.`
              );
            }
          }
        }

        const productIds = order.items.map((line) => line.productId).sort();
        for (const productId of productIds) {
          await tx.$executeRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
        }
        const currentProducts = await tx.product.findMany({
          where: { id: { in: productIds } }
        });
        const currentProductMap = new Map(
          currentProducts.map((product) => [product.id, product])
        );

        const receiptNumber = await nextFolio(tx, "PURCHASE_RECEIPT", "REC");
        const created = await tx.purchaseReceipt.create({
          data: {
            clientRequestId: input.clientRequestId,
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
                  quantity: new Prisma.Decimal(item.quantity),
                  unitCost: line.unitCost
                };
              })
            }
          },
          include: { items: true }
        });

        for (const item of input.items) {
          const line = orderLineMap.get(item.purchaseOrderItemId)!;
          const product = currentProductMap.get(line.productId);
          if (!product) {
            throw new ApiError(404, "Producto de la orden no encontrado.");
          }
          const quantity = new Prisma.Decimal(item.quantity);
          const stockBefore = product.currentStock;
          const stockAfter = stockBefore.plus(quantity);
          const baseUnitCost =
            order.currency === settings.baseCurrency
              ? line.unitCost
              : roundCost(line.unitCost.mul(order.exchangeRate));
          const valuedCurrentStock = stockBefore.gt(0) ? stockBefore : new Prisma.Decimal(0);
          const denominator = valuedCurrentStock.plus(quantity);
          const averageCost = denominator.gt(0)
            ? roundCost(
                valuedCurrentStock
                  .mul(product.cost)
                  .plus(baseUnitCost.mul(quantity))
                  .div(denominator)
              )
            : baseUnitCost;

          const lineUpdated = await tx.purchaseOrderItem.updateMany({
            where: { id: line.id, quantityReceived: line.quantityReceived },
            data: { quantityReceived: { increment: quantity } }
          });
          if (lineUpdated.count !== 1) {
            throw new ApiError(
              409,
              `La recepción de ${line.nameSnapshot} cambió concurrentemente.`
            );
          }
          const warehouseBefore = product.warehouseStock;
          const warehouseAfter = warehouseBefore.plus(quantity);
          const productUpdated = await tx.product.updateMany({
            where: { id: line.productId, currentStock: stockBefore },
            data: { 
              currentStock: stockAfter, 
              warehouseStock: warehouseAfter,
              cost: averageCost 
            }
          });
          if (productUpdated.count !== 1) {
            throw new ApiError(
              409,
              `Las existencias de ${line.nameSnapshot} cambiaron concurrentemente.`
            );
          }
          await tx.stockMovement.create({
            data: {
              productId: line.productId,
              userId: user.id,
              type: "PURCHASE_RECEIPT",
              quantity,
              stockBefore,
              stockAfter,
              unitCost: baseUnitCost,
              referenceType: "PurchaseReceipt",
              referenceId: created.id,
              idempotencyKey: `${input.clientRequestId}:${line.id}`,
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
          (line.quantityReceived.gte(line.quantityOrdered))
        );
        const orderUpdated = await tx.purchaseOrder.updateMany({
          where: {
            id: order.id,
            status: {
              in: [
                PurchaseOrderStatus.SENT,
                PurchaseOrderStatus.PARTIALLY_RECEIVED
              ]
            }
          },
          data: {
            status: complete
              ? PurchaseOrderStatus.RECEIVED
              : PurchaseOrderStatus.PARTIALLY_RECEIVED
          }
        });
        if (orderUpdated.count !== 1) {
          throw new ApiError(409, "La orden cambió de estado durante la recepción.");
        }
        return { receipt: created, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const receipt = result.receipt;

    if (result.created) {
      const metadata = await requestMetadata();
      await audit({
        userId: user.id,
        action: "PURCHASE_RECEIVED",
        entityType: "PurchaseReceipt",
        entityId: receipt.id,
        ip: metadata.ip,
        metadata: { receiptNumber: receipt.receiptNumber, purchaseOrderId: id }
      });
    }
    return jsonOk(receipt, result.created ? 201 : 200);
  } catch (error) {
    return jsonError(error);
  }
}
