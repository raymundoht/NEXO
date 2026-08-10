import { Prisma, ProductStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";

const schema = z.object({
  sku: z.string().trim().min(1).max(80).optional(),
  barcode: z.string().trim().max(80).optional().nullable(),
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  unit: z.string().trim().min(1).max(20).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  status: z.nativeEnum(ProductStatus).optional(),
  cost: z.coerce.number().min(0).optional(),
  salePrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  minStock: z.coerce.number().min(0).optional(),
  maxStock: z.coerce.number().min(0).optional().nullable(),
  allowNegative: z.boolean().optional()
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
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "Producto no encontrado.", "NOT_FOUND");
    }

    const nextMin = new Prisma.Decimal(input.minStock ?? existing.minStock);
    const nextMax =
      input.maxStock === null
        ? null
        : new Prisma.Decimal(input.maxStock ?? existing.maxStock ?? 0);
    if (nextMax && nextMax.lt(nextMin)) {
      throw new ApiError(
        400,
        "El stock máximo no puede ser menor al mínimo."
      );
    }

    const product = await db.product.update({
      where: { id },
      data: {
        ...input,
        ...(input.sku ? { sku: input.sku.toUpperCase() } : {}),
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
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: product.id,
      ip: metadata.ip,
      metadata: { fields: Object.keys(input) }
    });
    return jsonOk(product);
  } catch (error) {
    return jsonError(error);
  }
}
