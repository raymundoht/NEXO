import {
  Prisma,
  PurchaseOrderStatus
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ApiError,
  getPagination,
  jsonError,
  jsonOk,
  readJson
} from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { currency, positiveQuantity, uuid } from "@/lib/validators";
import { decimal, roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  supplierId: uuid,
  currency: currency.default("MXN"),
  exchangeRate: z.coerce.number().positive().max(1_000_000).default(1),
  expectedAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  sendNow: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: uuid,
        quantity: positiveQuantity,
        unitCost: z.coerce.number().min(0).max(1_000_000_000),
        taxRate: z.coerce.number().min(0).max(100).optional()
      })
    )
    .min(1)
    .max(500)
});

export async function GET(request: Request) {
  try {
    await requirePermission("purchases.read");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const supplierId = searchParams.get("supplierId");
    const status = searchParams.get("status") as PurchaseOrderStatus | null;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(supplierId ? { supplierId } : {}),
      ...(status && Object.values(PurchaseOrderStatus).includes(status)
        ? { status }
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
      db.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, code: true, legalName: true } },
          buyer: { select: { id: true, name: true } },
          _count: { select: { items: true, receipts: true } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      db.purchaseOrder.count({ where })
    ]);

    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("purchases.write");
    const input = createSchema.parse(await readJson(request));
    const productIds = input.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new ApiError(400, "No repitas productos en la misma orden.");
    }

    const order = await db.$transaction(
      async (tx) => {
        const [supplier, products] = await Promise.all([
          tx.supplier.findFirst({
            where: { id: input.supplierId, active: true }
          }),
          tx.product.findMany({
            where: { id: { in: productIds }, status: "ACTIVE" }
          })
        ]);
        if (!supplier) {
          throw new ApiError(404, "Proveedor no encontrado o inactivo.");
        }
        if (products.length !== productIds.length) {
          throw new ApiError(400, "Uno o más productos no están disponibles.");
        }
        const productMap = new Map(products.map((product) => [product.id, product]));
        const lines = input.items.map((item) => {
          const product = productMap.get(item.productId)!;
          const quantity = decimal(item.quantity);
          const unitCost = decimal(item.unitCost);
          const taxRate = decimal(item.taxRate ?? product.taxRate);
          const lineSubtotal = roundMoney(quantity.mul(unitCost));
          const lineTax = roundMoney(lineSubtotal.mul(taxRate).div(100));
          return {
            productId: item.productId,
            quantityOrdered: quantity,
            unitCost,
            taxRate,
            lineSubtotal,
            lineTax,
            lineTotal: roundMoney(lineSubtotal.plus(lineTax))
          };
        });
        const totals = lines.reduce(
          (acc, line) => ({
            subtotal: roundMoney(acc.subtotal.plus(line.lineSubtotal)),
            tax: roundMoney(acc.tax.plus(line.lineTax)),
            total: roundMoney(acc.total.plus(line.lineTotal))
          }),
          { subtotal: decimal(0), tax: decimal(0), total: decimal(0) }
        );
        const folio = await nextFolio(tx, "PURCHASE_ORDER", "OC");
        return tx.purchaseOrder.create({
          data: {
            folio,
            supplierId: input.supplierId,
            buyerId: user.id,
            status: input.sendNow
              ? PurchaseOrderStatus.SENT
              : PurchaseOrderStatus.DRAFT,
            currency: input.currency,
            exchangeRate: decimal(input.exchangeRate),
            subtotal: totals.subtotal,
            taxTotal: totals.tax,
            total: totals.total,
            expectedAt: input.expectedAt,
            notes: input.notes ? sanitizeText(input.notes, 2000) : null,
            sentAt: input.sendNow ? new Date() : null,
            items: { create: lines }
          },
          include: { items: true, supplier: true }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PurchaseOrder",
      entityId: order.id,
      ip: metadata.ip,
      metadata: { folio: order.folio, status: order.status }
    });
    return jsonOk(order, 201);
  } catch (error) {
    return jsonError(error);
  }
}
