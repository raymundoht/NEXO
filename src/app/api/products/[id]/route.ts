import { Prisma, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";
import { nonNegativeQuantity } from "@/lib/validators";
import { roundCost } from "@/lib/money";

const schema = z.object({
  sku: z.string().trim().min(1).max(80).optional(),
  barcode: z.string().trim().max(80).optional().nullable().refine(
    (val) => !val || /^\d{8,14}$/.test(val),
    "El código de barras debe contener solo números (8 a 14 dígitos)."
  ),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  unit: z.string().trim().min(1).max(20).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(ProductStatus).optional(),
  cost: z.coerce.number().min(0).max(1_000_000_000).optional(),
  salePrice: z.coerce.number().min(0).max(1_000_000_000).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: nonNegativeQuantity.optional(),
  maxStock: nonNegativeQuantity.optional().nullable(),
  allowNegative: z.boolean().optional(),
  updatedAt: z.string().datetime().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("inventory.write");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const { updatedAt, ...changes } = input;
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Producto no encontrado.", "NOT_FOUND");
    }

    const nextMin = new Prisma.Decimal(input.minStock ?? existing.minStock);
    const nextMax =
      input.maxStock === undefined
        ? existing.maxStock
        :
      input.maxStock === null
        ? null
        : new Prisma.Decimal(input.maxStock);
    if (nextMax && (nextMax < nextMin)) {
      throw new ApiError(
        400,
        "El stock máximo no puede ser menor al mínimo."
      );
    }

    const updated = await db.product.updateMany({
      where: {
        id,
        ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {})
      },
      data: {
        ...changes,
        ...(input.cost !== undefined
          ? { cost: roundCost(new Prisma.Decimal(input.cost)) }
          : {}),
        ...(input.salePrice !== undefined
          ? { salePrice: roundCost(new Prisma.Decimal(input.salePrice)) }
          : {}),
        ...(input.sku ? { sku: input.sku.toUpperCase() } : {}),
        ...(input.barcode !== undefined
          ? { barcode: input.barcode || null }
          : {}),
        ...(input.name ? { name: sanitizeText(input.name, 200) } : {}),
        ...(input.description !== undefined
          ? {
              description: input.description
                ? sanitizeText(input.description, 2000)
                : null
            }
          : {})
      }
    });
    if (updated.count !== 1) {
      throw new ApiError(
        409,
        "El producto cambió mientras lo editabas. Vuelve a abrirlo e intenta de nuevo.",
        "CONCURRENT_CHANGE"
      );
    }
    const product = await db.product.findUniqueOrThrow({ where: { id } });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: product.id,
      ip: metadata.ip,
      metadata: { fields: Object.keys(changes) }
    });
    return jsonOk(product);
  } catch (error) {
    return jsonError(error);
  }
}
