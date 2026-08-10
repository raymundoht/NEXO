import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET() {
  try {
    await requirePermission("pos.sell");
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });
    return jsonOk({
      baseCurrency: settings.baseCurrency,
      allowedCurrencies: settings.allowedCurrencies,
      maxCashierDiscountRate: settings.maxCashierDiscountRate
    });
  } catch (error) {
    return jsonError(error);
  }
}
