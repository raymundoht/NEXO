import { InventoryCountStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { } from "@/lib/money";
import { nonNegativeQuantity } from "@/lib/validators";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        countedQuantity: nonNegativeQuantity,
        notes: z.string().trim().max(300).optional().nullable()
      })
    )
    .min(1)
    .max(5_000)
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("inventory.audit");
    const { id } = await context.params;
    const count = await db.inventoryCount.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } }
          },
          orderBy: { product: { name: "asc" } }
        }
      }
    });
    if (!count) throw new ApiError(404, "Conteo no encontrado.");
    return jsonOk(count);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    await requirePermission("inventory.audit");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM inventory_counts WHERE id = ${id}::uuid FOR UPDATE`;
        const count = await tx.inventoryCount.findUnique({
          where: { id },
          include: { items: true }
        });
        if (!count) throw new ApiError(404, "Conteo no encontrado.");
        if (count.status !== InventoryCountStatus.IN_PROGRESS) {
          throw new ApiError(409, "Este conteo ya no puede modificarse.");
        }
        const itemMap = new Map(count.items.map((item) => [item.id, item]));
        if (input.items.some((item) => !itemMap.has(item.id))) {
          throw new ApiError(400, "Una partida no pertenece a este conteo.");
        }
        for (const item of input.items) {
          const original = itemMap.get(item.id)!;
          const counted = new Prisma.Decimal(item.countedQuantity);
          await tx.inventoryCountItem.update({
            where: { id: item.id },
            data: {
              countedQuantity: counted,
              difference: counted.minus(original.systemQuantity),
              notes: item.notes ? sanitizeText(item.notes, 300) : null
            }
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return jsonOk({ updated: input.items.length });
  } catch (error) {
    return jsonError(error);
  }
}
