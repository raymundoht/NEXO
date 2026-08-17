import { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { parseBusinessDate } from "@/lib/export";
import { roundMoney } from "@/lib/money";

const BUSINESS_TIME_ZONE = "America/Chihuahua";

function businessDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function GET() {
  try {
    const user = await requirePermission("dashboard.read");
    const todayKey = businessDateKey(new Date());
    const startToday = parseBusinessDate(todayKey);
    const weekStart = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const cashierFilter = user.role === Role.CASHIER ? { cashierId: user.id } : {};
    const canSeeSales = user.role === Role.ADMIN || user.role === Role.CASHIER;
    const inventoryRoles: Role[] = [Role.ADMIN, Role.WAREHOUSE, Role.BUYER];
    const canSeeInventory = inventoryRoles.includes(user.role);
    const canSeePurchases = canSeeInventory;
    const canSeeCash = user.role === Role.ADMIN || user.role === Role.CASHIER;

    const [settings, products, openPurchases, openCashSessions, weekSales] =
      await Promise.all([
        db.businessSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {}
        }),
        canSeeInventory
          ? db.product.findMany({
              where: { status: "ACTIVE" },
              select: {
                id: true,
                sku: true,
                name: true,
                currentStock: true,
                minStock: true,
                maxStock: true
              }
            })
          : Promise.resolve([]),
        canSeePurchases
          ? db.purchaseOrder.count({
              where: { status: { in: ["SENT", "PARTIALLY_RECEIVED"] } }
            })
          : Promise.resolve(0),
        canSeeCash
          ? db.cashSession.count({
              where: {
                status: "OPEN",
                ...(user.role === Role.CASHIER ? { cashierId: user.id } : {})
              }
            })
          : Promise.resolve(0),
        canSeeSales
          ? db.sale.findMany({
              where: {
                ...cashierFilter,
                status: {
                  in: ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"]
                },
                completedAt: { gte: weekStart }
              },
              include: {
                items: true,
                refunds: { include: { items: true } }
              },
              orderBy: { completedAt: "asc" }
            })
          : Promise.resolve([])
      ]);

    const lowStock = products.filter((product) =>
      (product.currentStock.lte(product.minStock))
    );
    const highStock = products.filter(
      (product) =>
        product.maxStock && (product.currentStock.gte(product.maxStock))
    );
    const dailyMap = new Map<string, Prisma.Decimal>();
    for (let index = 0; index < 7; index++) {
      const date = new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000);
      dailyMap.set(businessDateKey(date), new Prisma.Decimal(0));
    }

    let todaySales = new Prisma.Decimal(0);
    let todayTransactions = 0;
    const topProducts = new Map<
      string,
      { productId: string; name: string; quantity: Prisma.Decimal; total: Prisma.Decimal }
    >();

    for (const sale of weekSales) {
      if (!sale.completedAt) continue;
        const conversion =
          sale.currency === settings.baseCurrency ? new Prisma.Decimal(1) : sale.exchangeRate;
      const refundedTotal = sale.refunds.reduce(
        (total, refund) => total.plus(refund.amount),
        new Prisma.Decimal(0)
      );
      const net = roundMoney(
        Prisma.Decimal.max(sale.total.minus(refundedTotal), new Prisma.Decimal(0)).mul(conversion)
      );
      const key = businessDateKey(sale.completedAt);
      if (dailyMap.has(key)) {
        dailyMap.set(key, roundMoney((dailyMap.get(key) ?? new Prisma.Decimal(0)).plus(net)));
      }
      if (key === todayKey && net.gt(0)) {
        todaySales = roundMoney(todaySales.plus(net));
        todayTransactions += 1;
      }

      const refundedByLine = new Map<
        string,
        { quantity: Prisma.Decimal; amount: Prisma.Decimal }
      >();
      for (const refund of sale.refunds) {
        for (const item of refund.items) {
          const current = refundedByLine.get(item.saleItemId) || {
            quantity: new Prisma.Decimal(0),
            amount: new Prisma.Decimal(0)
          };
          current.quantity = current.quantity.plus(new Prisma.Decimal(item.quantity));
          current.amount = current.amount.plus(item.amount);
          refundedByLine.set(item.saleItemId, current);
        }
      }
      for (const item of sale.items) {
        const refunded = refundedByLine.get(item.id) || {
          quantity: new Prisma.Decimal(0),
          amount: new Prisma.Decimal(0)
        };
        const quantity = Prisma.Decimal.max(
          item.quantity.minus(refunded.quantity),
          new Prisma.Decimal(0)
        );
        const total = roundMoney(
          Prisma.Decimal.max(item.lineTotal.minus(refunded.amount), new Prisma.Decimal(0)).mul(
            conversion
          )
        );
        const aggregate = topProducts.get(item.productId) || {
          productId: item.productId,
          name: item.nameSnapshot,
          quantity: new Prisma.Decimal(0),
          total: new Prisma.Decimal(0)
        };
        aggregate.name = item.nameSnapshot;
        aggregate.quantity = aggregate.quantity.plus(quantity);
        aggregate.total = roundMoney(aggregate.total.plus(total));
        topProducts.set(item.productId, aggregate);
      }
    }

    return jsonOk({
      currency: settings.baseCurrency,
      visibility: {
        sales: canSeeSales,
        inventory: canSeeInventory,
        purchases: canSeePurchases,
        cash: canSeeCash
      },
      metrics: {
        todaySales,
        todayTransactions,
        lowStock: lowStock.length,
        highStock: highStock.length,
        openPurchases,
        openCashSessions
      },
      stockAlerts: lowStock.slice(0, 8),
      salesTrend: [...dailyMap].map(([date, total]) => ({ date, total })),
      topProducts: [...topProducts.values()]
        .filter((item) => (item.quantity.gt(0)))
        .sort((left, right) => right.quantity.minus(left.quantity).toNumber())
        .slice(0, 5)
    });
  } catch (error) {
    return jsonError(error);
  }
}
