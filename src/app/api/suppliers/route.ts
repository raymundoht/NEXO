import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getPagination, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { audit } from "@/lib/audit";

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional().nullable(),
  taxId: z.string().trim().max(30).optional().nullable(),
  email: z.string().email().max(320).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  contactName: z.string().trim().max(160).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  creditDays: z.coerce.number().int().min(0).max(3650).default(0),
  deliveryDays: z.coerce.number().int().min(0).max(3650).default(0),
  creditLimit: z.coerce.number().min(0).optional().nullable(),
  paymentTerms: z.string().trim().max(300).optional().nullable(),
  active: z.boolean().default(true)
});

export async function GET(request: Request) {
  try {
    await requirePermission("purchases.read");
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim().slice(0, 100);
    const activeParam = searchParams.get("active");
    const { page, pageSize, skip, take } = getPagination(request.url);
    const where: Prisma.SupplierWhereInput = {
      ...(activeParam === "true"
        ? { active: true }
        : activeParam === "false"
          ? { active: false }
          : {}),
      ...(q
        ? {
          OR: [
            { legalName: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { taxId: { contains: q, mode: "insensitive" } }
          ]
        }
        : {})
    };
    const [items, total] = await db.$transaction([
      db.supplier.findMany({ where, orderBy: { legalName: "asc" }, skip, take }),
      db.supplier.count({ where })
    ]);
    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("suppliers.manage");
    const input = schema.parse(await readJson(request));
    const supplier = await db.supplier.create({
      data: {
        ...input,
        code: input.code.toUpperCase(),
        legalName: sanitizeText(input.legalName, 200),
        tradeName: input.tradeName
          ? sanitizeText(input.tradeName, 200)
          : null,
        address: input.address ? sanitizeText(input.address, 1000) : null,
        creditLimit:
          input.creditLimit == null
            ? null
            : new Prisma.Decimal(input.creditLimit)
      }
    });
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: supplier.id,
      ip: metadata.ip,
      metadata: { code: supplier.code }
    });
    return jsonOk(supplier, 201);
  } catch (error) {
    return jsonError(error);
  }
}
