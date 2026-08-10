import { db } from "@/lib/db";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { fulfillSaleOnce } from "@/services/sales";
import { Prisma } from "@prisma/client";

export async function POST() {
  try {
    await requirePermission("sales.manage");

    // Look for pending/processing attempts older than 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000);
    
    const orphans = await db.paymentAttempt.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        createdAt: { lt: thirtyMinutesAgo }
      },
      take: 20
    });

    const results = [];

    for (const attempt of orphans) {
      try {
        let session;

        if (attempt.checkoutSessionId) {
          session = await stripe.checkout.sessions.retrieve(attempt.checkoutSessionId, { expand: ['payment_intent'] });
        }

        if (session) {
          if (session.payment_status === 'paid' && session.mode === 'payment' && session.livemode === false) {
             const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
             const chargeId = typeof session.payment_intent !== 'string' ? session.payment_intent?.latest_charge : null;
             
             await fulfillSaleOnce(
               session.id, 
               intentId as string, 
               typeof chargeId === 'string' ? chargeId : null,
               Number(session.amount_total)
             );
             results.push({ id: attempt.id, action: "FULFILLED" });
          } else if (session.status === 'expired' || (session.status === 'complete' && session.payment_status === 'unpaid')) {
             await expireAttempt(attempt.id);
             results.push({ id: attempt.id, action: "EXPIRED" });
          } else {
             results.push({ id: attempt.id, action: "STILL_OPEN" });
          }
        } else {
          // No session id, failed creation
          await expireAttempt(attempt.id);
          results.push({ id: attempt.id, action: "FAILED_CREATION" });
        }
      } catch (err: unknown) {
        results.push({ id: attempt.id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return jsonOk({ processed: orphans.length, results });
  } catch (error) {
    return jsonError(error);
  }
}

async function expireAttempt(attemptId: string) {
  let retries = 3;
  while (retries > 0) {
    try {
      await db.$transaction(async (tx) => {
        const attempt = await tx.paymentAttempt.findUnique({
          where: { id: attemptId }
        });
        if (!attempt || !['PENDING', 'PROCESSING'].includes(attempt.status)) {
          return;
        }

        await tx.stockReservation.updateMany({
          where: { paymentAttemptId: attemptId, consumedAt: null, releasedAt: null },
          data: { releasedAt: new Date() }
        });
        
        await tx.paymentAttempt.update({
          where: { id: attemptId },
          data: { status: 'EXPIRED' }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 100));
          continue;
        }
      }
      throw error;
    }
  }
}
