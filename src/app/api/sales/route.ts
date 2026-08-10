import {
  PaymentMethod,
  Prisma,
  Role,
  SaleStatus
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import {
  cardAuthorization,
  currency,
  positiveQuantity,
  uuid
} from "@/lib/validators";
import { createSale } from "@/services/sales";
import { audit } from "@/lib/audit";

const schema = z.object({
  mode: z.enum(["HOLD", "COMPLETE"]).default("COMPLETE"),
  customerName: z.string().trim().max(160).optional().nullable(),
  currency: currency.default("MXN"),
  exchangeRate: z.coerce.number().positive().max(1_000_000).default(1),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z
    .array(
      z.object({
        productId: uuid,
        quantity: positiveQuantity,
        discountAmount: z.coerce.number().min(0).optional()
      })
    )
    .min(1)
    .max(200),
  payment: z
    .object({
      cashRegisterId: uuid,
      paymentMethod: z.nativeEnum(PaymentMethod),
      amountTendered: z.coerce.number().min(0).optional(),
      cardAuthorization: cardAuthorization.optional()
    })
    .optional()
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("sales.read");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const status = searchParams.get("status") as SaleStatus | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const cashierId = searchParams.get("cashierId");
    const cashierCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const where: Prisma.SaleWhereInput = {
      ...(user.role === Role.ADMIN
        ? cashierId
          ? { cashierId }
          : {}
        : { cashierId: user.id, createdAt: { gte: cashierCutoff } }),
      ...(status && Object.values(SaleStatus).includes(status)
        ? { status }
        : {}),
      ...(user.role === Role.ADMIN && (from || to)
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {})
            }
          }
        : {})
    };
    const [items, total] = await db.$transaction([
      db.sale.findMany({
        where,
        include: {
          cashier: { select: { id: true, name: true } },
          cashRegister: { select: { id: true, code: true, name: true } },
          _count: { select: { items: true, refunds: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      db.sale.count({ where })
    ]);
    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("pos.sell");
    const input = schema.parse(await readJson(request));
    const sale = await createSale(user, input);
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: input.mode === "HOLD" ? "SALE_HELD" : "SALE_COMPLETED",
      entityType: "Sale",
      entityId: sale.id,
      ip: metadata.ip,
      metadata: { folio: sale.folio, total: sale.total.toString() }
    });
    return jsonOk(sale, 201);
  } catch (error) {
    return jsonError(error);
  }
}
