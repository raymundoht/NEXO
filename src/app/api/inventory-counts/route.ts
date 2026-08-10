import { InventoryCountStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk, readJson, ApiError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { nextFolio } from "@/lib/sequence";

const schema = z.object({
  productIds: z.array(z.string().uuid()).max(5_000).optional(),
  notes: z.string().trim().max(2000).optional().nullable()
});

export async function GET(request: Request) {
  try {
    await requirePermission("inventory.audit");
    const { page, pageSize, skip, take } = getPagination(request.url);
    const [items, total] = await db.$transaction([
      db.inventoryCount.findMany({
        include: {
          createdBy: { select: { id: true, name: true } },
          completedBy: { select: { id: true, name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      db.inventoryCount.count()
    ]);
    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.audit");
    const input = schema.parse(await readJson(request));
    const count = await db.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
          where: {
            status: "ACTIVE",
            ...(input.productIds?.length
              ? { id: { in: [...new Set(input.productIds)] } }
              : {})
          },
          orderBy: { name: "asc" }
        });
        if (!products.length) {
          throw new ApiError(400, "No hay productos para contar.");
        }
        const folio = await nextFolio(tx, "INVENTORY_COUNT", "INV");
        return tx.inventoryCount.create({
          data: {
            folio,
            status: InventoryCountStatus.IN_PROGRESS,
            createdById: user.id,
            startedAt: new Date(),
            notes: input.notes ? sanitizeText(input.notes, 2000) : null,
            items: {
              create: products.map((product) => ({
                productId: product.id,
                systemQuantity: product.currentStock
              }))
            }
          },
          include: {
            items: {
              include: {
                product: { select: { id: true, sku: true, name: true, unit: true } }
              }
            }
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    return jsonOk(count, 201);
  } catch (error) {
    return jsonError(error);
  }
}
