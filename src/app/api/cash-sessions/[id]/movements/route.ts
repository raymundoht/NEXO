import { CashMovementType } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assertTrustedOrigin, sanitizeText } from "@/lib/security";
import { decimal } from "@/lib/money";

const schema = z.object({
  type: z.enum(["CASH_IN", "CASH_OUT"]),
  amount: z.coerce.number().positive().max(1_000_000_000),
  notes: z.string().trim().min(5).max(300)
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
    const session = await db.cashSession.findFirst({
      where: {
        id,
        status: "OPEN",
        ...(user.role === "ADMIN" ? {} : { cashierId: user.id })
      }
    });
    if (!session) throw new ApiError(404, "Sesión de caja abierta no encontrada.");
    const signedAmount =
      input.type === "CASH_OUT"
        ? decimal(input.amount).negated()
        : decimal(input.amount);
    const movement = await db.cashMovement.create({
      data: {
        cashSessionId: session.id,
        userId: user.id,
        type: CashMovementType[input.type],
        amount: signedAmount,
        currency: session.currency,
        referenceType: "ManualCashMovement",
        notes: sanitizeText(input.notes, 300)
      }
    });
    return jsonOk({ ...movement, id: movement.id.toString() }, 201);
  } catch (error) {
    return jsonError(error);
  }
}
