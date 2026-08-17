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
import { roundCost, roundMoney } from "@/lib/money";
import { nextFolio } from "@/lib/sequence";
import { audit } from "@/lib/audit";
import { parseBusinessDate } from "@/lib/export";
import { sendSupplierRestockRequestEmail } from "@/lib/mailer";

const createSchema = z.object({
  clientRequestId: uuid,
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
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    try {
      fromDate = from ? parseBusinessDate(from) : undefined;
      toDate = to ? parseBusinessDate(to, true) : undefined;
    } catch {
      throw new ApiError(400, "El rango de fechas es inválido.");
    }
    if (fromDate && toDate && fromDate > toDate) {
      throw new ApiError(400, "La fecha inicial no puede ser posterior a la final.");
    }
    const where: Prisma.PurchaseOrderWhereInput = {
      ...(supplierId ? { supplierId } : {}),
      ...(status && Object.values(PurchaseOrderStatus).includes(status)
        ? { status }
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

    const result = await db.$transaction(
      async (tx) => {
        const existing = await tx.purchaseOrder.findUnique({
          where: { clientRequestId: input.clientRequestId },
          include: { items: true, supplier: true }
        });
        if (existing) {
          if (existing.buyerId !== user.id) {
            throw new ApiError(409, "El identificador de solicitud ya fue utilizado.");
          }
          return { order: existing, created: false };
        }

        const [supplier, products, settings] = await Promise.all([
          tx.supplier.findFirst({
            where: { id: input.supplierId, active: true }
          }),
          tx.product.findMany({
            where: { id: { in: productIds }, status: "ACTIVE" }
          }),
          tx.businessSettings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {}
          })
        ]);
        if (!supplier) {
          throw new ApiError(404, "Proveedor no encontrado o inactivo.");
        }
        if (products.length !== productIds.length) {
          throw new ApiError(400, "Uno o más productos no están disponibles.");
        }
        if (!settings.allowedCurrencies.includes(input.currency)) {
          throw new ApiError(400, "La moneda no está habilitada.");
        }
        if (
          input.currency === settings.baseCurrency &&
          Number(input.exchangeRate) !== 1
        ) {
          throw new ApiError(400, "El tipo de cambio de la moneda base debe ser 1.");
        }
        const productMap = new Map(products.map((product) => [product.id, product]));
        const lines = input.items.map((item) => {
          const product = productMap.get(item.productId)!;
          const quantity = Number(item.quantity);
          const unitCost = roundCost(new Prisma.Decimal(item.unitCost));
          const taxRate = Number(item.taxRate ?? product.taxRate);
          const lineSubtotal = roundMoney(unitCost.mul(quantity));
          const lineTax = roundMoney(lineSubtotal.mul(taxRate).div(100));
          return {
            productId: item.productId,
            skuSnapshot: product.sku,
            nameSnapshot: product.name,
            unitSnapshot: product.unit,
            quantityOrdered: quantity,
            unitCost,
            taxRate,
            lineSubtotal,
            lineTax,
            lineTotal: roundMoney(lineSubtotal.plus(lineTax))
          };
        });
        const totals = lines.reduce<{
          subtotal: Prisma.Decimal;
          tax: Prisma.Decimal;
          total: Prisma.Decimal;
        }>(
          (acc, line) => ({
            subtotal: acc.subtotal.plus(line.lineSubtotal),
            tax: acc.tax.plus(line.lineTax),
            total: acc.total.plus(line.lineTotal)
          }),
          { subtotal: new Prisma.Decimal(0), tax: new Prisma.Decimal(0), total: new Prisma.Decimal(0) }
        );
        const folio = await nextFolio(tx, "PURCHASE_ORDER", "OC");
        const order = await tx.purchaseOrder.create({
          data: {
            clientRequestId: input.clientRequestId,
            folio,
            supplierId: input.supplierId,
            buyerId: user.id,
            supplierCodeSnapshot: supplier.code,
            supplierNameSnapshot: supplier.legalName,
            buyerNameSnapshot: user.name,
            status: input.sendNow
              ? PurchaseOrderStatus.SENT
              : PurchaseOrderStatus.DRAFT,
            currency: input.currency,
            exchangeRate: Number(input.exchangeRate),
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
        return { order, created: true };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const order = result.order;

    if (result.created) {
      const metadata = await requestMetadata();
      await audit({
        userId: user.id,
        action: "PURCHASE_ORDER_CREATED",
        entityType: "PurchaseOrder",
        entityId: order.id,
        ip: metadata.ip,
        metadata: { folio: order.folio, status: order.status }
      });

      // Check supplier allocation quotas and send restock email if exceeded
      const quotaWarnings: Array<{
        productName: string;
        sku: string;
        currentAllocation: number;
        totalReceived: number;
        additionalNeeded: number;
      }> = [];

      for (const item of order.items) {
        const supplierProduct = await db.supplierProduct.findUnique({
          where: {
            supplierId_productId: {
              supplierId: order.supplierId,
              productId: item.productId
            }
          }
        });
        if (supplierProduct?.allocatedQty != null) {
          const received = await db.purchaseReceiptItem.aggregate({
            where: {
              productId: item.productId,
              receipt: {
                purchaseOrder: { supplierId: order.supplierId }
              }
            },
            _sum: { quantity: true }
          });
          const totalReceived = Number(received._sum.quantity || 0);
          const wouldBeTotal = totalReceived + Number(item.quantityOrdered);
          const allocation = Number(supplierProduct.allocatedQty);
          if (wouldBeTotal > allocation) {
            quotaWarnings.push({
              productName: item.nameSnapshot,
              sku: item.skuSnapshot,
              currentAllocation: allocation,
              totalReceived,
              additionalNeeded: Math.ceil(wouldBeTotal - allocation)
            });
          }
        }
      }

      if (quotaWarnings.length > 0 && order.supplier.email) {
        const settings = await db.businessSettings.upsert({
          where: { id: 1 },
          create: { id: 1 },
          update: {}
        });
        // Fire-and-forget: don't block the response
        void sendSupplierRestockRequestEmail({
          to: order.supplier.email,
          supplierName: order.supplier.tradeName || order.supplier.legalName,
          businessName: settings.businessName,
          items: quotaWarnings
        }).catch((err) => {
          console.error("[RESTOCK EMAIL] Error al enviar:", err);
        });
      }

      return jsonOk(
        {
          ...order,
          quotaWarnings: quotaWarnings.length > 0 ? quotaWarnings : undefined
        },
        201
      );
    }
    return jsonOk(order, 200);
  } catch (error) {
    return jsonError(error);
  }
}
