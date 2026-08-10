import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    // Both cashier and admin should be able to view status
    await requirePermission("sales.create");
    const { id } = await context.params;

    const attempt = await db.paymentAttempt.findUnique({
      where: { clientRequestId: id },
      select: {
        id: true,
        status: true,
        saleId: true,
        checkoutSessionId: true,
        errorMessage: true,
        reasonCode: true
      }
    });

    if (!attempt) {
      // It might be a checkoutSessionId if the user returned via Stripe success_url
      // The frontend might pass checkout_session_id as clientRequestId if the local state was lost.
      const sessionAttempt = await db.paymentAttempt.findUnique({
        where: { checkoutSessionId: id },
        select: {
          id: true,
          status: true,
          saleId: true,
          checkoutSessionId: true,
          errorMessage: true,
          reasonCode: true
        }
      });
      if (!sessionAttempt) {
        throw new ApiError(404, "Intento de pago no encontrado.");
      }
      return jsonOk(sessionAttempt);
    }

    return jsonOk(attempt);
  } catch (error) {
    return jsonError(error);
  }
}
