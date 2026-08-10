import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, jsonError, jsonOk, readJson } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { stripe, moneyToMinorUnits } from "@/lib/stripe";
import { assertTrustedOrigin } from "@/lib/security";

const checkoutSchema = z.object({
  clientRequestId: z.string().uuid(),
  saleId: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
  cashSessionId: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    assertTrustedOrigin(request);
    const actor = await requirePermission("pos.sell");
    const input = checkoutSchema.parse(await readJson(request));

    const origin = process.env.APP_URL || "http://localhost:3000";
    const env = process.env.STRIPE_SECRET_KEY?.includes("test") ? "TEST" : "LIVE";

    let attemptId = "";
    let saleTotal: Prisma.Decimal = new Prisma.Decimal(0);
    let isNewAttempt = false;
    let checkoutSessionId: string | null = null;

    let retries = 3;
    while (retries > 0) {
      try {
        const result = await db.$transaction(async (tx) => {
          const existingAttempt = await tx.paymentAttempt.findUnique({
            where: { clientRequestId: input.clientRequestId },
          });

          if (existingAttempt) {
            if (
              existingAttempt.saleId !== input.saleId ||
              existingAttempt.cashRegisterId !== input.cashRegisterId ||
              existingAttempt.cashSessionId !== input.cashSessionId ||
              existingAttempt.cashierId !== actor.id
            ) {
              throw new ApiError(409, "El clientRequestId ya se usó para otra transacción diferente.");
            }
            if (['SUCCEEDED', 'FAILED', 'EXPIRED'].includes(existingAttempt.status)) {
              throw new ApiError(409, "El intento de pago ya finalizó.");
            }
            const sale = await tx.sale.findUnique({ where: { id: input.saleId } });
            if (!sale) throw new ApiError(404, "Venta no encontrada.");
            
            return { attempt: existingAttempt, isNew: false, sale };
          }

          const sale = await tx.sale.findUnique({
            where: { id: input.saleId },
            include: { items: { include: { product: true } } }
          });
          
          if (!sale) throw new ApiError(404, "Venta no encontrada.");
          if (sale.status !== "HELD") {
            throw new ApiError(409, "La venta debe estar en espera para cobrar con tarjeta.");
          }
          if (sale.currency !== "MXN") {
            throw new ApiError(400, "Solo se permiten pagos en MXN con tarjeta.");
          }

          const session = await tx.cashSession.findUnique({ where: { id: input.cashSessionId } });
          if (!session || session.status !== 'OPEN' || session.cashierId !== actor.id || session.cashRegisterId !== input.cashRegisterId) {
            throw new ApiError(403, "Caja o sesión inválida.");
          }

          // Bloqueo determinista de productos
          const productIds = sale.items.map(i => i.productId).sort();
          for (const pid of productIds) {
            await tx.$executeRaw`SELECT id FROM products WHERE id = ${pid}::uuid FOR UPDATE;`;
          }

          const expiresAt = new Date(Date.now() + 35 * 60 * 1000); // 35 min

          for (const item of sale.items) {
            const activeReservations = await tx.stockReservation.aggregate({
              where: {
                productId: item.productId,
                consumedAt: null,
                releasedAt: null,
                expiresAt: { gt: new Date() }
              },
              _sum: { quantity: true }
            });
            const reserved = activeReservations._sum.quantity || 0;
            const available = Number(item.product.currentStock) - Number(reserved);
            if (available < Number(item.quantity)) {
              throw new ApiError(409, `Inventario insuficiente para ${item.nameSnapshot}.`);
            }
          }

          const newAttempt = await tx.paymentAttempt.create({
            data: {
              clientRequestId: input.clientRequestId,
              saleId: sale.id,
              expectedAmount: sale.total,
              currency: sale.currency,
              cashierId: actor.id,
              cashRegisterId: input.cashRegisterId,
              cashSessionId: input.cashSessionId,
              environment: env,
              stockReservations: {
                create: sale.items.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  expiresAt
                }))
              }
            }
          });

          return { attempt: newAttempt, isNew: true, sale };
        }, { isolationLevel: "Serializable" });

        attemptId = result.attempt.id;
        saleTotal = result.sale.total;
        isNewAttempt = result.isNew;
        checkoutSessionId = result.attempt.checkoutSessionId;
        break; // Éxito, salir del loop
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034' && retries > 1) {
          retries--;
          await new Promise(r => setTimeout(r, 100)); // Delay
          continue;
        }
        throw err;
      }
    }

    if (!isNewAttempt && checkoutSessionId) {
      const existingSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      if (existingSession.url) {
        return jsonOk({ url: existingSession.url });
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
          price_data: {
              currency: "mxn",
              unit_amount: moneyToMinorUnits(saleTotal, "mxn"),
              product_data: { name: `Venta NEXO` }
          },
          quantity: 1
      }],
      client_reference_id: attemptId,
      success_url: `${origin}/payment/result?clientRequestId=${input.clientRequestId}`,
      cancel_url: `${origin}/payment/result?clientRequestId=${input.clientRequestId}&cancel=true`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      metadata: {
        paymentAttemptId: attemptId,
        saleId: input.saleId,
        cashierId: actor.id
      }
    }, { idempotencyKey: `checkout-session:${attemptId}` });

    if (!checkoutSessionId) {
      await db.paymentAttempt.update({
        where: { id: attemptId },
        data: { checkoutSessionId: session.id }
      });
    }

    return jsonOk({ url: session.url });

  } catch (error) {
    return jsonError(error);
  }
}
