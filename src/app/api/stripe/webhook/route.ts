import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { fulfillSaleOnce } from "@/services/sales";
import Stripe from "stripe";
import { finalizeStripeRefund } from "@/services/stripe-refunds";

export async function POST(request: Request) {
  const body = await request.text();
  const headerStore = await headers();
  const signature = headerStore.get("stripe-signature") as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("Webhook secret no configurado", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(`Error firma webhook: ${msg}`, { status: 400 });
  }

  // Idempotency: Atomic claim
  let webhookEvent = await db.paymentWebhookEvent.findUnique({
    where: { stripeEventId: event.id }
  });

  const now = new Date();
  
  if (webhookEvent) {
    if (webhookEvent.processingStatus === 'PROCESSED') {
      return new Response("Ya procesado", { status: 200 });
    }
    if (webhookEvent.processingStatus === 'PROCESSING' && webhookEvent.lockedUntil && webhookEvent.lockedUntil > now) {
      return new Response("Procesamiento en curso", { status: 500 });
    }

    // Recover abandoned or retry
    const updated = await db.paymentWebhookEvent.updateMany({
      where: {
        id: webhookEvent.id,
        OR: [
          { processingStatus: { in: ['RECEIVED', 'ERROR', 'RETRY_REQUIRED'] } },
          { processingStatus: 'PROCESSING', lockedUntil: { lte: now } }
        ]
      },
      data: {
        processingStatus: 'PROCESSING',
        lockedUntil: new Date(now.getTime() + 5 * 60000)
      }
    });
    
    if (updated.count === 0) {
      return new Response("Ignorado concurrentemente", { status: 200 });
    }
  } else {
    try {
      webhookEvent = await db.paymentWebhookEvent.upsert({
        where: { stripeEventId: event.id },
        create: {
          stripeEventId: event.id,
          eventType: event.type,
          stripeObjectId: (event.data.object as Stripe.Event.Data.Object & { id?: string }).id || "",
          processingStatus: 'PROCESSING',
          lockedUntil: new Date(now.getTime() + 5 * 60000)
        },
        update: {
          processingStatus: 'PROCESSING',
          lockedUntil: new Date(now.getTime() + 5 * 60000)
        }
      });
    } catch (error) {
      console.error("No fue posible reclamar el webhook de Stripe.", error);
      return new Response("No fue posible guardar el evento", { status: 500 });
    }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const stripeObject = event.data.object as Stripe.Checkout.Session;
      const session = await stripe.checkout.sessions.retrieve(stripeObject.id, { expand: ['payment_intent'] });

      if (
        session.mode !== 'payment' ||
        session.payment_status !== 'paid' ||
        session.currency !== 'mxn' ||
        session.livemode !== false
      ) {
        throw new Error("La sesión pagada no coincide con el entorno o moneda autorizados.");
      }
      {
        const attemptId = session.metadata?.paymentAttemptId || session.client_reference_id;
        if (!attemptId) {
          throw new Error("No se pudo localizar el intento de pago.");
        }

        const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
        const chargeId = typeof session.payment_intent !== 'string' ? session.payment_intent?.latest_charge : null;
        if (!intentId) throw new Error("Stripe no devolvió un PaymentIntent confirmado.");

        // Check if we need to link it first (if it arrived before checkout endpoint saved it)
        const attempt = await db.paymentAttempt.findUnique({ where: { id: attemptId } });
        if (!attempt) {
          throw new Error("Intento de pago inexistente.");
        }

        if (!attempt.checkoutSessionId) {
          await db.paymentAttempt.update({
            where: { id: attemptId },
            data: { checkoutSessionId: session.id }
          });
        }

        await fulfillSaleOnce(
          session.id, 
          intentId,
          typeof chargeId === 'string' ? chargeId : null,
          Number(session.amount_total)
        );
      }
    } else if (event.type === 'checkout.session.expired') {
       const session = event.data.object as Stripe.Checkout.Session;
       await db.$transaction([
         db.stockReservation.updateMany({
           where: { paymentAttempt: { checkoutSessionId: session.id }, consumedAt: null, releasedAt: null },
           data: { releasedAt: new Date() }
         }),
         db.paymentAttempt.updateMany({
           where: { checkoutSessionId: session.id, status: { in: ['PENDING', 'PROCESSING'] } },
           data: { status: 'EXPIRED' }
         })
       ]);
    } else if (event.type === 'refund.updated') {
      const providerRefund = event.data.object as Stripe.Refund;
      const paymentRefundId = providerRefund.metadata?.paymentRefundId;
      const localRefund = paymentRefundId
        ? await db.paymentRefund.findUnique({ where: { id: paymentRefundId } })
        : await db.paymentRefund.findUnique({
            where: { stripeRefundId: providerRefund.id }
          });
      if (!localRefund) {
        throw new Error("No se encontró la devolución local asociada a Stripe.");
      }
      if (providerRefund.status === "succeeded") {
        await finalizeStripeRefund(localRefund.id, providerRefund.id);
      } else if (providerRefund.status === "failed" || providerRefund.status === "canceled") {
        await db.paymentRefund.update({
          where: { id: localRefund.id },
          data: {
            status: "FAILED",
            stripeRefundId: providerRefund.id,
            error: `Stripe devolvió estado ${providerRefund.status}`
          }
        });
      }
    }

    await db.paymentWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: { processingStatus: 'PROCESSED', processedAt: new Date(), lockedUntil: null }
    });

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (err: unknown) {
    const isRetryable = (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') || (err instanceof Error && err.message.includes('deadlock'));
    const msg = err instanceof Error ? err.message : String(err);
    
    await db.paymentWebhookEvent.update({
      where: { stripeEventId: event.id },
      data: {
        processingStatus: isRetryable ? 'RETRY_REQUIRED' : 'ERROR',
        error: msg.slice(0, 500),
        lockedUntil: null
      }
    });

    return new Response("No fue posible procesar el evento; reintente", { status: 500 });
  }
}
