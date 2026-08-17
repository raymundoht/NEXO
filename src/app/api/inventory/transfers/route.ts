import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { } from "@/lib/money";

const schema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1_000_000),
  direction: z.enum(["TO_STORE", "TO_WAREHOUSE"]),
  reason: z.string().trim().max(300).optional()
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.write");
    const input = schema.parse(await readJson(request));

    const transfer = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM products WHERE id = ${input.productId}::uuid FOR UPDATE`;
        const product = await tx.product.findUnique({
          where: { id: input.productId }
        });
        if (!product) throw new ApiError(404, "Producto no encontrado.");

        const quantity = Number(input.quantity);
        let storeStockAfter = product.storeStock;
        let warehouseStockAfter = product.warehouseStock;

        if (input.direction === "TO_STORE") {
           if (product.warehouseStock.lt(quantity) && !product.allowNegative) {
              throw new ApiError(409, "Inventario insuficiente en almacén para transferir.");
           }
           warehouseStockAfter = product.warehouseStock.minus(quantity);
           storeStockAfter = product.storeStock.plus(quantity);
        } else {
           if (product.storeStock.lt(quantity) && !product.allowNegative) {
              throw new ApiError(409, "Inventario insuficiente en tienda para transferir.");
           }
           storeStockAfter = product.storeStock.minus(quantity);
           warehouseStockAfter = product.warehouseStock.plus(quantity);
        }

        const updated = await tx.product.updateMany({
          where: { 
            id: product.id, 
            storeStock: product.storeStock,
            warehouseStock: product.warehouseStock
          },
          data: { 
            storeStock: storeStockAfter,
            warehouseStock: warehouseStockAfter
          }
        });

        if (updated.count !== 1) {
          throw new ApiError(409, "El inventario cambió concurrentemente. Intenta de nuevo.");
        }

        const movement = await tx.stockMovement.create({
          data: {
            productId: product.id,
            userId: user.id,
            type: "MANUAL_ADJUSTMENT",
            quantity: 0, 
            stockBefore: product.currentStock,
            stockAfter: product.currentStock,
            unitCost: product.cost,
            referenceType: "Transfer",
            reason: sanitizeText(input.reason || `Transferencia: ${input.direction === 'TO_STORE' ? 'Almacén -> Tienda' : 'Tienda -> Almacén'}`, 300)
          }
        });
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "INVENTORY_TRANSFER",
      entityType: "StockMovement",
      entityId: transfer.id.toString(),
      ip: metadata.ip,
      metadata: { productId: input.productId, quantity: input.quantity, direction: input.direction }
    });

    return jsonOk({ ...transfer, id: transfer.id.toString() }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
