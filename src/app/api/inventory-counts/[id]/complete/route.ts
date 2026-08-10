import { InventoryCountStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.audit");
    const { id } = await context.params;
    const result = await db.$transaction(
      async (tx) => {
        const count = await tx.inventoryCount.findUnique({
          where: { id },
          include: { items: { include: { product: true } } }
        });
        if (!count) throw new ApiError(404, "Conteo no encontrado.");
        if (count.status !== InventoryCountStatus.IN_PROGRESS) {
          throw new ApiError(409, "El conteo ya fue cerrado.");
        }
        if (count.items.some((item) => item.countedQuantity === null)) {
          throw new ApiError(400, "Faltan productos por contar.");
        }
        const changedDuringCount = count.items.find(
          (item) => !item.product.currentStock.equals(item.systemQuantity)
        );
        if (changedDuringCount) {
          throw new ApiError(
            409,
            `El producto ${changedDuringCount.product.name} tuvo movimientos durante el conteo. Reinicia el conteo para evitar sobrescribir operaciones.`
          );
        }

        let adjustments = 0;
        for (const item of count.items) {
          const counted = item.countedQuantity!;
          const difference = counted.minus(item.systemQuantity);
          if (difference.isZero()) continue;
          adjustments++;
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: counted }
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId: user.id,
              type: "INVENTORY_ADJUSTMENT",
              quantity: difference,
              stockBefore: item.systemQuantity,
              stockAfter: counted,
              unitCost: item.product.cost,
              referenceType: "InventoryCount",
              referenceId: count.id,
              reason: `Cierre de conteo ${count.folio}`
            }
          });
        }
        const updated = await tx.inventoryCount.update({
          where: { id },
          data: {
            status: InventoryCountStatus.COMPLETED,
            completedById: user.id,
            completedAt: new Date()
          }
        });
        return { count: updated, adjustments };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "INVENTORY_COUNT_COMPLETED",
      entityType: "InventoryCount",
      entityId: id,
      ip: metadata.ip,
      metadata: { adjustments: result.adjustments }
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
