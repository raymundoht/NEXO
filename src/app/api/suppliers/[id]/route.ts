import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";

const schema = z.object({
  code: z.string().trim().min(1).max(40).optional(),
  legalName: z.string().trim().min(2).max(200).optional(),
  tradeName: z.string().trim().max(200).optional().nullable(),
  taxId: z.string().trim().max(30).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  contactName: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  creditDays: z.coerce.number().int().min(0).max(3650).optional(),
  deliveryDays: z.coerce.number().int().min(0).max(3650).optional(),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  paymentTerms: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().optional()
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("purchases.read");
    const { id } = await context.params;
    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        productPrices: {
          include: {
            product: {
              select: { id: true, sku: true, name: true, unit: true }
            }
          },
          orderBy: { product: { name: "asc" } }
        }
      }
    });
    if (!supplier) throw new ApiError(404, "Proveedor no encontrado.");
    return jsonOk(supplier);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("suppliers.manage");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Proveedor no encontrado.");
    const supplier = await db.supplier.update({
      where: { id },
      data: {
        ...input,
        ...(input.code ? { code: input.code.toUpperCase() } : {}),
        ...(input.legalName
          ? { legalName: sanitizeText(input.legalName, 200) }
          : {}),
        ...(input.tradeName !== undefined
          ? {
              tradeName: input.tradeName
                ? sanitizeText(input.tradeName, 200)
                : null
            }
          : {}),
        ...(input.address !== undefined
          ? {
              address: input.address
                ? sanitizeText(input.address, 1000)
                : null
            }
          : {}),
        ...(input.creditLimit !== undefined
          ? {
              creditLimit:
                input.creditLimit === null
                  ? null
                  : new Prisma.Decimal(input.creditLimit)
            }
          : {})
      }
    });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "SUPPLIER_UPDATED",
      entityType: "Supplier",
      entityId: supplier.id,
      ip: metadata.ip,
      metadata: { fields: Object.keys(input) }
    });
    return jsonOk(supplier);
  } catch (error) {
    return jsonError(error);
  }
}
