import { InventoryCountStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { decimal } from "@/lib/money";

const schema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        countedQuantity: z.coerce.number().min(0).max(1_000_000),
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
    const count = await db.inventoryCount.findUnique({
      where: { id },
      include: { items: true }
    });
    if (!count) throw new ApiError(404, "Conteo no encontrado.");
    if (count.status !== InventoryCountStatus.IN_PROGRESS) {
      throw new ApiError(409, "Este conteo ya no puede modificarse.");
    }
    const validIds = new Set(count.items.map((item) => item.id));
    if (input.items.some((item) => !validIds.has(item.id))) {
      throw new ApiError(400, "Una partida no pertenece a este conteo.");
    }
    await db.$transaction(
      input.items.map((item) => {
        const original = count.items.find((line) => line.id === item.id)!;
        const counted = decimal(item.countedQuantity);
        return db.inventoryCountItem.update({
          where: { id: item.id },
          data: {
            countedQuantity: counted,
            difference: counted.minus(original.systemQuantity),
            notes: item.notes ? sanitizeText(item.notes, 300) : null
          }
        });
      })
    );
    return jsonOk({ updated: input.items.length });
  } catch (error) {
    return jsonError(error);
  }
}
