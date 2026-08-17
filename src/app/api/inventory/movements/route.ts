import { Prisma, StockMovementType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, getPagination, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { parseBusinessDate } from "@/lib/export";

export async function GET(request: Request) {
  try {
    await requirePermission("inventory.read");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const productId = searchParams.get("productId");
    const type = searchParams.get("type") as StockMovementType | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (productId && !z.string().uuid().safeParse(productId).success) {
      throw new ApiError(400, "El producto seleccionado es inválido.");
    }
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    try {
      fromDate = from ? parseBusinessDate(from) : undefined;
      toDate = to ? parseBusinessDate(to, true) : undefined;
    } catch {
      throw new ApiError(400, "El rango de fechas es inválido.");
    }
    const where: Prisma.StockMovementWhereInput = {
      ...(productId ? { productId } : {}),
      ...(type && Object.values(StockMovementType).includes(type)
        ? { type }
        : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {})
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
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
