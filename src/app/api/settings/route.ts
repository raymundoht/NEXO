import { z } from "zod";
import { db } from "@/lib/db";
import { jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";

const schema = z
  .object({
    businessName: z.string().trim().min(2).max(180),
    taxId: z.string().trim().max(30).optional().nullable(),
    address: z.string().trim().max(1000).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    baseCurrency: z.enum(["MXN", "USD"]),
    allowedCurrencies: z
      .array(z.enum(["MXN", "USD"]))
      .min(1)
      .max(2)
      .refine(
        (currencies) => new Set(currencies).size === currencies.length,
        "No repitas monedas habilitadas."
      ),
    defaultTaxRate: z.coerce.number().min(0).max(100),
    maxCashierDiscountRate: z.coerce.number().min(0).max(100),
    ticketFooter: z.string().trim().max(300).optional().nullable()
  })
  .refine((input) => input.allowedCurrencies.includes(input.baseCurrency), {
    path: ["allowedCurrencies"],
    message: "La moneda base debe estar habilitada."
  });

export async function GET() {
  try {
    await requirePermission("settings.manage");
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {}
    });
    return jsonOk(settings);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("settings.manage");
    const input = schema.parse(await readJson(request));
    const settings = await db.businessSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        ...input,
        businessName: sanitizeText(input.businessName, 180)
      },
      update: {
        ...input,
        businessName: sanitizeText(input.businessName, 180)
      }
    });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "SETTINGS_UPDATED",
      entityType: "BusinessSettings",
      entityId: "1",
      ip: metadata.ip
    });
    return jsonOk(settings);
  } catch (error) {
    return jsonError(error);
  }
}
