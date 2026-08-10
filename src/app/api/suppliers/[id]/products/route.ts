import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";
import { currency, uuid } from "@/lib/validators";

const schema = z.object({
  productId: uuid,
  supplierSku: z.string().trim().max(80).optional().nullable(),
  referenceCost: z.coerce.number().min(0).max(1_000_000_000),
  currency: currency.default("MXN"),
  leadDays: z.coerce.number().int().min(0).max(3650).default(0),
  isPreferred: z.boolean().default(false)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("suppliers.manage");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const [supplier, product] = await Promise.all([
      db.supplier.findFirst({ where: { id, active: true } }),
      db.product.findUnique({ where: { id: input.productId } })
    ]);
    if (!supplier) throw new ApiError(404, "Proveedor no encontrado o inactivo.");
    if (!product) throw new ApiError(404, "Producto no encontrado.");

    const price = await db.$transaction(async (tx) => {
      if (input.isPreferred) {
        await tx.supplierProduct.updateMany({
          where: { productId: input.productId, supplierId: { not: id } },
          data: { isPreferred: false }
        });
      }
      return tx.supplierProduct.upsert({
        where: {
          supplierId_productId: {
            supplierId: id,
            productId: input.productId
          }
        },
        create: {
          supplierId: id,
          productId: input.productId,
          supplierSku: input.supplierSku || null,
          referenceCost: new Prisma.Decimal(input.referenceCost),
          currency: input.currency,
          leadDays: input.leadDays,
          isPreferred: input.isPreferred
        },
        update: {
          supplierSku: input.supplierSku || null,
          referenceCost: new Prisma.Decimal(input.referenceCost),
          currency: input.currency,
          leadDays: input.leadDays,
          isPreferred: input.isPreferred
        },
        include: {
          product: { select: { id: true, sku: true, name: true, unit: true } }
        }
      });
    });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "SUPPLIER_PRICE_UPDATED",
      entityType: "SupplierProduct",
      entityId: price.id,
      ip: metadata.ip,
      metadata: {
        supplierId: id,
        productId: input.productId,
        currency: input.currency
      }
    });
    return jsonOk(price, 201);
  } catch (error) {
    return jsonError(error);
  }
}
