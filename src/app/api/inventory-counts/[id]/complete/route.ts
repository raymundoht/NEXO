import { InventoryCountStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";
import { nonNegativeQuantity } from "@/lib/validators";
import { } from "@/lib/money";

const schema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      countedQuantity: nonNegativeQuantity,
      notes: z.string().trim().max(300).optional().nullable()
    })
  ).min(1).max(5_000)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.audit");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const result = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM inventory_counts WHERE id = ${id}::uuid FOR UPDATE`;
        const current = await tx.inventoryCount.findUnique({
          where: { id },
          include: { items: true }
        });
        if (!current) throw new ApiError(404, "Conteo no encontrado.");
        if (current.status !== InventoryCountStatus.IN_PROGRESS) {
          throw new ApiError(409, "El conteo ya fue cerrado.");
        }
        const itemMap = new Map(current.items.map((item) => [item.id, item]));
        if (
          input.items.length !== current.items.length ||
          input.items.some((item) => !itemMap.has(item.id))
        ) {
          throw new ApiError(400, "Las partidas no corresponden al conteo completo.");
        }
        for (const item of input.items) {
          const original = itemMap.get(item.id)!;
          const counted = new Prisma.Decimal(item.countedQuantity);
          await tx.inventoryCountItem.update({
            where: { id: item.id },
            data: {
              countedQuantity: counted,
              difference: counted.minus(original.systemQuantity),
              notes: item.notes?.trim() || null
            }
          });
        }
        const count = await tx.inventoryCount.findUniqueOrThrow({
          where: { id },
          include: { items: { include: { product: true } } }
        });
        if (count.items.some((item) => item.countedQuantity === null)) {
          throw new ApiError(400, "Faltan productos por contar.");
        }
        const movementDuringCount = await tx.stockMovement.findFirst({
          where: {
            productId: { in: count.items.map((item) => item.productId) },
            createdAt: { gt: count.startedAt || count.createdAt }
          },
          select: { productId: true }
        });
        if (movementDuringCount) {
          const changed = count.items.find(
            (item) => item.productId === movementDuringCount.productId
          );
          throw new ApiError(
            409,
            `El producto ${changed?.product.name || "seleccionado"} tuvo movimientos durante el conteo. Reinicia el conteo para evitar sobrescribir operaciones.`
          );
        }
        const changedDuringCount = count.items.find(
          (item) => item.product.currentStock !== item.systemQuantity
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
          if (difference.equals(0)) continue;
          adjustments++;
          const updatedProduct = await tx.product.updateMany({
            where: { id: item.productId, currentStock: item.systemQuantity },
            data: { currentStock: counted }
          });
          if (updatedProduct.count !== 1) {
            throw new ApiError(409, `Las existencias de ${item.product.name} cambiaron durante el cierre.`);
          }
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
