import { Prisma, StockMovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requirePermission("inventory.read");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const productId = searchParams.get("productId");
    const type = searchParams.get("type") as StockMovementType | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: Prisma.StockMovementWhereInput = {
      ...(productId ? { productId } : {}),
      ...(type && Object.values(StockMovementType).includes(type)
        ? { type }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    };
    const [items, total] = await db.$transaction([
      db.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, sku: true, name: true } },
          user: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      db.stockMovement.count({ where })
    ]);
    return jsonOk({
      items: items.map((item) => ({ ...item, id: item.id.toString() })),
      pagination: { page, pageSize, total }
    });
  } catch (error) {
    return jsonError(error);
  }
}
