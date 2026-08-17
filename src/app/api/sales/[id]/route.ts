import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("sales.read");
    const { id } = await context.params;
    const cashierCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sale = await db.sale.findFirst({
      where: {
        id,
        ...(user.role === Role.ADMIN
          ? {}
          : { cashierId: user.id, createdAt: { gte: cashierCutoff } })
      },
      include: {
        cashier: { select: { id: true, name: true } },
        cashRegister: true,
        items: true,
        refunds: {
          include: {
            approvedBy: { select: { id: true, name: true } },
            items: true
          }
        }
      }
    });
    if (!sale) throw new ApiError(404, "Venta no encontrada.");
    const refundedByItem = new Map<string, number>();
    sale.refunds.forEach((refund) => {
      refund.items.forEach((item) => {
        refundedByItem.set(
          item.saleItemId,
          (refundedByItem.get(item.saleItemId) || 0) +
            Number(item.quantity)
        );
      });
    });
    return jsonOk({
      ...sale,
      items: sale.items.map((item) => {
        const quantityRefunded = refundedByItem.get(item.id) || 0;
        return {
          ...item,
          quantityRefunded,
          quantityAvailableToRefund: Math.max(
            0,
            Number(item.quantity) - quantityRefunded
          )
        };
      })
    });
  } catch (error) {
    return jsonError(error);
  }
}
