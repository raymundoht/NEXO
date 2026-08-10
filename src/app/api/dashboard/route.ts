import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requirePermission("dashboard.read");
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    weekStart.setHours(0, 0, 0, 0);
    const cashierFilter =
      user.role === Role.CASHIER ? { cashierId: user.id } : {};
    const canSeeSales =
      user.role === Role.ADMIN || user.role === Role.CASHIER;
    const canSeeInventory =
      user.role === Role.ADMIN ||
      user.role === Role.WAREHOUSE ||
      user.role === Role.BUYER;
    const canSeePurchases =
      user.role === Role.ADMIN ||
      user.role === Role.WAREHOUSE ||
      user.role === Role.BUYER;
    const canSeeCash =
      user.role === Role.ADMIN || user.role === Role.CASHIER;

    const [
      todaySales,
      todayCount,
      products,
      openPurchases,
      openCashSessions,
      recentSales,
      topLines
    ] = await Promise.all([
      canSeeSales ? db.sale.aggregate({
        where: {
          ...cashierFilter,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
          completedAt: { gte: startToday }
        },
        _sum: { total: true }
      }) : Promise.resolve({ _sum: { total: null } }),
      canSeeSales ? db.sale.count({
        where: {
          ...cashierFilter,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
          completedAt: { gte: startToday }
        }
      }) : Promise.resolve(0),
      !canSeeInventory
        ? Promise.resolve([])
        : db.product.findMany({
            where: { status: "ACTIVE" },
            select: {
              id: true,
              sku: true,
              name: true,
              currentStock: true,
              minStock: true,
              maxStock: true
            }
          }),
      !canSeePurchases
        ? Promise.resolve(0)
        : db.purchaseOrder.count({
            where: { status: { in: ["SENT", "PARTIALLY_RECEIVED"] } }
          }),
      canSeeCash ? db.cashSession.count({
        where: {
          status: "OPEN",
          ...(user.role === Role.CASHIER ? { cashierId: user.id } : {})
        }
      }) : Promise.resolve(0),
      canSeeSales ? db.sale.findMany({
        where: {
          ...cashierFilter,
          status: { in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"] },
          completedAt: { gte: weekStart }
        },
        select: { completedAt: true, total: true },
        orderBy: { completedAt: "asc" }
      }) : Promise.resolve([]),
      canSeeSales ? db.saleItem.groupBy({
        by: ["productId", "nameSnapshot"],
        where: {
          sale: {
            ...cashierFilter,
            status: { in: ["COMPLETED", "PARTIALLY_REFUNDED"] },
            completedAt: { gte: weekStart }
          }
        },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5
      }) : Promise.resolve([])
    ]);

    const lowStock = products.filter((product) =>
      product.currentStock.lte(product.minStock)
    );
    const highStock = products.filter(
      (product) =>
        product.maxStock && product.currentStock.gte(product.maxStock)
    );
    const dailyMap = new Map<string, Prisma.Decimal>();
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
      dailyMap.set(date.toISOString().slice(0, 10), new Prisma.Decimal(0));
    }
    recentSales.forEach((sale) => {
      if (!sale.completedAt) return;
      const key = sale.completedAt.toISOString().slice(0, 10);
      dailyMap.set(key, (dailyMap.get(key) || new Prisma.Decimal(0)).plus(sale.total));
    });

    return jsonOk({
      visibility: {
        sales: canSeeSales,
        inventory: canSeeInventory,
        purchases: canSeePurchases,
        cash: canSeeCash
      },
      metrics: {
        todaySales: todaySales._sum.total || new Prisma.Decimal(0),
        todayTransactions: todayCount,
        lowStock: lowStock.length,
        highStock: highStock.length,
        openPurchases,
        openCashSessions
      },
      stockAlerts: lowStock.slice(0, 8),
      salesTrend: [...dailyMap].map(([date, total]) => ({ date, total })),
      topProducts: topLines.map((line) => ({
        productId: line.productId,
        name: line.nameSnapshot,
        quantity: line._sum.quantity || new Prisma.Decimal(0),
        total: line._sum.lineTotal || new Prisma.Decimal(0)
      }))
    });
  } catch (error) {
    return jsonError(error);
  }
}
