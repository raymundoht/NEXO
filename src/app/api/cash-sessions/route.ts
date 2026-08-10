import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, getPagination, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { currency, nonNegativeMoney, uuid } from "@/lib/validators";
import { decimal } from "@/lib/money";
import { audit } from "@/lib/audit";
import {
  denominationTotal,
  denominationsFor,
  supportsCashDenominations
} from "@/lib/cash-denominations";

const openSchema = z.object({
  cashRegisterId: uuid,
  currency: currency.default("MXN"),
  openingAmount: nonNegativeMoney,
  denominations: z
    .record(
      z.string().regex(/^\d+(\.\d{1,2})?$/),
      z.coerce.number().int().min(0).max(1_000_000)
    )
    .refine((value) => Object.keys(value).length > 0, "Captura las denominaciones.")
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("cash.manage");
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, take } = getPagination(request.url);
    const onlyOpen = searchParams.get("open") === "true";
    const where: Prisma.CashSessionWhereInput = {
      ...(user.role === Role.ADMIN ? {} : { cashierId: user.id }),
      ...(onlyOpen ? { status: "OPEN" } : {})
    };
    const [items, total] = await db.$transaction([
      db.cashSession.findMany({
        where,
        include: {
          cashRegister: true,
          cashier: { select: { id: true, name: true } }
        },
        orderBy: { openedAt: "desc" },
        skip,
        take
      }),
      db.cashSession.count({ where })
    ]);
    return jsonOk({ items, pagination: { page, pageSize, total } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("cash.manage");
    const input = openSchema.parse(await readJson(request));
    if (!supportsCashDenominations(input.currency)) {
      throw new ApiError(
        400,
        "La moneda no tiene denominaciones de efectivo configuradas."
      );
    }
    const allowedDenominations = new Set(
      denominationsFor(input.currency).map(String)
    );
    if (
      Object.keys(input.denominations).some(
        (denomination) => !allowedDenominations.has(denomination)
      )
    ) {
      throw new ApiError(400, "El conteo contiene una denominación inválida.");
    }
    if (
      Math.round(Number(input.openingAmount) * 100) !==
      Math.round(denominationTotal(input.denominations) * 100)
    ) {
      throw new ApiError(
        400,
        "El fondo inicial no coincide con el conteo por denominaciones."
      );
    }
    const cashSession = await db.$transaction(
      async (tx) => {
        const [register, settings] = await Promise.all([
          tx.cashRegister.findFirst({
            where: { id: input.cashRegisterId, active: true }
          }),
          tx.businessSettings.upsert({
            where: { id: 1 },
            create: { id: 1 },
            update: {}
          })
        ]);
        if (!register) throw new ApiError(404, "Caja no encontrada o inactiva.");
        if (!settings.allowedCurrencies.includes(input.currency)) {
          throw new ApiError(400, "La moneda no está habilitada.");
        }
        const existing = await tx.cashSession.findFirst({
          where: {
            status: "OPEN",
            OR: [
              { cashierId: user.id },
              { cashRegisterId: input.cashRegisterId }
            ]
          }
        });
        if (existing) {
          throw new ApiError(
            409,
            "El cajero o la caja ya tienen una sesión abierta."
          );
        }
        const session = await tx.cashSession.create({
          data: {
            cashRegisterId: input.cashRegisterId,
            cashierId: user.id,
            currency: input.currency,
            openingAmount: decimal(input.openingAmount),
            openingDenominations: input.denominations
          }
        });
        await tx.cashMovement.create({
          data: {
            cashSessionId: session.id,
            userId: user.id,
            type: "OPENING",
            amount: decimal(input.openingAmount),
            currency: input.currency,
            referenceType: "CashSession",
            referenceId: session.id,
            notes: "Apertura de caja"
          }
        });
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "CASH_SESSION_OPENED",
      entityType: "CashSession",
      entityId: cashSession.id,
      ip: metadata.ip,
      metadata: { cashRegisterId: input.cashRegisterId }
    });
    return jsonOk(cashSession, 201);
  } catch (error) {
    return jsonError(error);
  }
}
