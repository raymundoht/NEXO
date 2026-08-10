import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { decimal, roundMoney } from "@/lib/money";
import { audit } from "@/lib/audit";
import {
  denominationTotal,
  denominationsFor,
  supportsCashDenominations
} from "@/lib/cash-denominations";

const schema = z.object({
  countedAmount: z.coerce.number().min(0).max(1_000_000_000),
  denominations: z
    .record(
      z.string().regex(/^\d+(\.\d{1,2})?$/),
      z.coerce.number().int().min(0).max(1_000_000)
    )
    .refine((value) => Object.keys(value).length > 0, "Captura las denominaciones."),
  notes: z.string().trim().max(1000).optional().nullable()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("cash.manage");
    const { id } = await context.params;
    const input = schema.parse(await readJson(request));
    if (
      Math.round(Number(input.countedAmount) * 100) !==
      Math.round(denominationTotal(input.denominations) * 100)
    ) {
      throw new ApiError(
        400,
        "El efectivo contado no coincide con las denominaciones."
      );
    }
    const closed = await db.$transaction(
      async (tx) => {
        const session = await tx.cashSession.findFirst({
          where: {
            id,
            status: "OPEN",
            ...(user.role === "ADMIN" ? {} : { cashierId: user.id })
          }
        });
        if (!session) {
          throw new ApiError(404, "Sesión de caja abierta no encontrada.");
        }
        if (!supportsCashDenominations(session.currency)) {
          throw new ApiError(
            400,
            "La moneda no tiene denominaciones de efectivo configuradas."
          );
        }
        const allowedDenominations = new Set(
          denominationsFor(session.currency).map(String)
        );
        if (
          Object.keys(input.denominations).some(
            (denomination) => !allowedDenominations.has(denomination)
          )
        ) {
          throw new ApiError(
            400,
            "El conteo contiene una denominación inválida."
          );
        }
        const aggregate = await tx.cashMovement.aggregate({
          where: { cashSessionId: id, currency: session.currency },
          _sum: { amount: true }
        });
        const expected = roundMoney(aggregate._sum.amount || decimal(0));
        const counted = roundMoney(decimal(input.countedAmount));
        const difference = counted.minus(expected);
        await tx.cashMovement.create({
          data: {
            cashSessionId: id,
            userId: user.id,
            type: "CLOSING",
            amount: decimal(0),
            currency: session.currency,
            referenceType: "CashSession",
            referenceId: id,
            notes: "Cierre de caja"
          }
        });
        return tx.cashSession.update({
          where: { id },
          data: {
            status: "CLOSED",
            expectedClosingAmount: expected,
            countedClosingAmount: counted,
            difference,
            closingDenominations: input.denominations,
            notes: input.notes ? sanitizeText(input.notes, 1000) : null,
            closedAt: new Date()
          }
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "CASH_SESSION_CLOSED",
      entityType: "CashSession",
      entityId: id,
      ip: metadata.ip,
      metadata: { difference: closed.difference?.toString() }
    });
    return jsonOk(closed);
  } catch (error) {
    return jsonError(error);
  }
}
