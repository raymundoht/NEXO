import { Prisma, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getPagination,
  jsonError,
  jsonOk,
  readJson
} from "@/lib/api";
import {
  requireAnyPermission,
  requirePermission,
  requestMetadata
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { can } from "@/lib/permissions";
import { nonNegativeQuantity } from "@/lib/validators";
import { roundCost } from "@/lib/money";

const productSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).optional().nullable().refine(
    (val) => !val || /^\d{8,14}$/.test(val),
    "El código de barras debe contener solo números (8 a 14 dígitos)."
  ),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("PZA"),
  categoryId: z.string().uuid().optional().nullable(),
  cost: z.coerce.number().min(0).max(1_000_000_000),
  salePrice: z.coerce.number().min(0).max(1_000_000_000),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: nonNegativeQuantity,
  maxStock: nonNegativeQuantity.optional().nullable(),
  allowNegative: z.boolean().default(false)
});

export async function GET(request: Request) {
  try {
    const user = await requireAnyPermission(["inventory.read", "pos.sell"]);
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url, 500);
    const q = searchParams.get("q")?.trim().slice(0, 100);
    const alert = searchParams.get("alert");
    const requestedStatus = searchParams.get("status");
    const status = requestedStatus as ProductStatus | null;
    const canReadInventory = can(user.role, "inventory.read");

    const where: Prisma.ProductWhereInput = {
      ...(requestedStatus === "ALL" && canReadInventory
        ? {}
        : status && Object.values(ProductStatus).includes(status)
        ? { status }
        : { status: ProductStatus.ACTIVE }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              { barcode: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    };

    const [items, total, settings] = await db.$transaction([
      db.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
        skip,
        take
      }),
      db.product.count({ where }),
      db.businessSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {}
      })
    ]);

    const filtered =
      alert === "low"
        ? items.filter((item) => (item.currentStock <= item.minStock))
        : alert === "high"
          ? items.filter(
              (item) => item.maxStock && (item.currentStock >= item.maxStock)
            )
          : items;

    return jsonOk({
      items: filtered.map((item) => {
        const stockAlert = (item.currentStock <= item.minStock)
          ? "LOW"
          : item.maxStock && (item.currentStock >= item.maxStock)
            ? "HIGH"
            : null;
        if (canReadInventory) return { ...item, stockAlert };
        return {
          id: item.id,
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          unit: item.unit,
          status: item.status,
          salePrice: item.salePrice,
          taxRate: item.taxRate,
          currentStock: item.currentStock,
          stockAlert
        };
      }),
      pagination: { page, pageSize, total },
      ...(canReadInventory
        ? { defaults: { taxRate: settings.defaultTaxRate.toString() } }
        : {})
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.write");
    const input = productSchema.parse(await readJson(request));
    if (input.maxStock != null && input.maxStock < input.minStock) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["maxStock"],
          message: "El máximo no puede ser menor al mínimo."
        }
      ]);
    }

    const product = await db.$transaction(async (tx) => {
      const settings = await tx.businessSettings.upsert({
        where: { id: 1 },
        create: { id: 1 },
        update: {}
      });
      return tx.product.create({
        data: {
          ...input,
          cost: roundCost(new Prisma.Decimal(input.cost)),
          salePrice: roundCost(new Prisma.Decimal(input.salePrice)),
          taxRate: input.taxRate ?? settings.defaultTaxRate,
          sku: input.sku.toUpperCase(),
          barcode: input.barcode || null,
          name: sanitizeText(input.name, 200),
          description: input.description
            ? sanitizeText(input.description, 2000)
            : null,
          currentStock: 0
        }
      });
    });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product.id,
      ip: metadata.ip,
      metadata: { sku: product.sku }
    });
    return jsonOk(product, 201);
  } catch (error) {
    return jsonError(error);
  }
}
