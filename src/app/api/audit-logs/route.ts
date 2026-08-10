import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requirePermission("audit.read");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(userId ? { userId } : {}),
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
      db.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      db.auditLog.count({ where })
    ]);
    return jsonOk({
      items: items.map((item) => ({ ...item, id: item.id.toString() })),
      pagination: { page, pageSize, total }
    });
  } catch (error) {
    return jsonError(error);
  }
}
