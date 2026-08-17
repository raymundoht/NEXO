import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requirePermission, requestMetadata } from "@/lib/auth";
import { assertTrustedOrigin } from "@/lib/security";
import { audit } from "@/lib/audit";
import { roundMoney } from "@/lib/money";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertTrustedOrigin(request);
    const user = await requirePermission("cash.manage");
    if (user.role !== "ADMIN") {
      throw new ApiError(403, "Sólo un administrador puede forzar el cierre de otra caja.");
    }
    const { id } = await context.params;

    const { closed, originalCashierId } = await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM cash_sessions WHERE id = ${id}::uuid FOR UPDATE`;
        const session = await tx.cashSession.findFirst({
          where: { id, status: "OPEN" }
        });
        if (!session) {
          throw new ApiError(404, "Sesión de caja abierta no encontrada.");
        }
        const activePayment = await tx.paymentAttempt.findFirst({
          where: {
            cashSessionId: id,
            status: { in: ["PENDING", "PROCESSING", "REVIEW_REQUIRED"] }
          },
          select: { id: true }
        });
        if (activePayment) {
          throw new ApiError(
            409,
            "No se puede forzar el cierre mientras exista un pago pendiente de conciliación."
          );
        }
        const aggregate = await tx.cashMovement.aggregate({
          where: { cashSessionId: id, currency: session.currency },
          _sum: { amount: true }
        });
        const expected = roundMoney(aggregate._sum.amount ?? new Prisma.Decimal(0));
        await tx.cashMovement.create({
          data: {
            cashSessionId: id,
            userId: user.id,
            type: "CLOSING",
            amount: 0,
            currency: session.currency,
            referenceType: "CashSession",
            referenceId: id,
            notes: "Cierre administrativo sin arqueo"
          }
        });
        const updated = await tx.cashSession.updateMany({
          where: { id, status: "OPEN" },
          data: {
            status: "CLOSED",
            expectedClosingAmount: expected,
            countedClosingAmount: null,
            difference: null,
            notes: `Cierre forzado por administrador ${user.id}. Sesión cerrada sin arqueo.`,
            closedAt: new Date()
          }
        });
        if (updated.count !== 1) {
          throw new ApiError(409, "La sesión de caja ya fue cerrada.");
        }
        return {
          closed: await tx.cashSession.findUniqueOrThrow({ where: { id } }),
          originalCashierId: session.cashierId
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const metadata = await requestMetadata();
    await audit({
      userId: user.id,
      action: "CASH_SESSION_FORCE_CLOSED",
      entityType: "CashSession",
      entityId: id,
      ip: metadata.ip,
      metadata: {
        originalCashierId,
        expectedAmount: closed.expectedClosingAmount?.toString()
      }
    });

    return jsonOk(closed);
  } catch (error) {
    return jsonError(error);
  }
}
