import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { decimal } from "@/lib/money";

const schema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().min(-1_000_000).max(1_000_000).refine((v) => v !== 0),
  reason: z.string().trim().min(10).max(300)
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.write");
    const input = schema.parse(await readJson(request));
    const movement = await db.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: input.productId }
        });
        if (!product) throw new ApiError(404, "Producto no encontrado.");
        const quantity = decimal(input.quantity);
        const stockAfter = product.currentStock.plus(quantity);
        if (stockAfter.lt(0) && !product.allowNegative) {
          throw new ApiError(409, "El ajuste dejaría existencias negativas.");
        }
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: stockAfter }
        });
        return tx.stockMovement.create({
          data: {
            productId: product.id,
            userId: user.id,
            type: "MANUAL_ADJUSTMENT",
            quantity,
            stockBefore: product.currentStock,
            stockAfter,
            unitCost: product.cost,
            referenceType: "ManualAdjustment",
            reason: sanitizeText(input.reason, 300)
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "INVENTORY_MANUAL_ADJUSTMENT",
      entityType: "StockMovement",
      entityId: movement.id.toString(),
      ip: metadata.ip,
      metadata: { productId: input.productId, quantity: input.quantity }
    });
    return jsonOk({ ...movement, id: movement.id.toString() }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
