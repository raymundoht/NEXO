import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { z } from "zod";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // Both cashier and admin should be able to view status
    const user = await requirePermission("pos.sell");
    const { id } = await context.params;

    const attempt = await db.paymentAttempt.findFirst({
      where: {
        ...(z.string().uuid().safeParse(id).success
          ? { clientRequestId: id }
          : { checkoutSessionId: id }),
        ...(user.role === "ADMIN" ? {} : { cashierId: user.id })
      },
      select: {
        id: true,
        status: true,
        saleId: true,
        checkoutSessionId: true,
        reasonCode: true
      }
    });

    if (!attempt) {
      throw new ApiError(404, "Intento de pago no encontrado.");
    }

    return jsonOk(attempt);
  } catch (error) {
    return jsonError(error);
  }
}
