/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/stripe/webhook/route';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { fulfillSaleOnce } from '@/services/sales';
import { Prisma } from '@prisma/client';

// Mock dependencies
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Map([['stripe-signature', 'fake-sig']])))
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn()
    },
    checkout: {
      sessions: {
        retrieve: vi.fn()
      }
    }
  }
}));

vi.mock('@/lib/db', () => ({
  db: {
    paymentWebhookEvent: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    },
    paymentAttempt: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn((cb) => cb({
      paymentAttempt: {
        update: vi.fn()
      }
    }))
  }
}));

vi.mock('@/services/sales', () => ({
  fulfillSaleOnce: vi.fn()
}));

const createMockRequest = () => {
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers: new Headers({
      'stripe-signature': 'fake-sig'
    }),
    body: JSON.stringify({ type: 'payment_intent.succeeded' })
  });
};

describe('Stripe Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('procesa un webhook válido y llama a fulfillSaleOnce', async () => {
    const fakeEvent = {
      id: 'evt_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_123',
          metadata: { paymentAttemptId: 'attempt_1' },
          payment_intent: 'pi_123'
        }
      }
    };

    (stripe.webhooks.constructEvent as any).mockReturnValue(fakeEvent);
    (stripe.checkout.sessions.retrieve as any).mockResolvedValue({
      id: 'cs_123',
      mode: 'payment',
      payment_status: 'paid',
      currency: 'mxn',
      livemode: false,
      amount_total: 1000,
      metadata: { paymentAttemptId: 'attempt_1' },
      payment_intent: 'pi_123'
    });
    (db.paymentWebhookEvent.upsert as any).mockResolvedValue({ id: 'evt_123' });
    (db.paymentAttempt.findUnique as any).mockResolvedValue({ id: 'attempt_1', checkoutSessionId: 'cs_123' });
    (fulfillSaleOnce as any).mockResolvedValue(true);

    const req = createMockRequest();
    const res = await POST(req);

    expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
    expect(db.paymentWebhookEvent.upsert).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_123' },
      create: expect.objectContaining({
        stripeEventId: 'evt_123',
        eventType: 'checkout.session.completed'
      }),
      update: expect.objectContaining({
        processingStatus: 'PROCESSING'
      })
    });
    
    expect(fulfillSaleOnce).toHaveBeenCalledWith('cs_123', 'pi_123', null, 1000);
    expect(res.status).toBe(200);
  });

  it('valida la idempotencia si el evento ya existe (P2002)', async () => {
    const fakeEvent = {
      id: 'evt_456',
      type: 'checkout.session.completed',
      data: {
        object: { id: 'cs_456', metadata: { paymentAttemptId: 'attempt_2' } }
      }
    };

    (stripe.webhooks.constructEvent as any).mockReturnValue(fakeEvent);
    
    // Simulate unique constraint failure (concurrent request or already exists)
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.x'
    });
    (db.paymentWebhookEvent.upsert as any).mockRejectedValue(err);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const req = createMockRequest();
    const res = await POST(req);

    expect(db.paymentWebhookEvent.upsert).toHaveBeenCalled();
    // It should NOT call fulfillSaleOnce because it was intercepted as duplicate
    expect(fulfillSaleOnce).not.toHaveBeenCalled();
    
    // This request did not process the event; Stripe must retry in case the
    // concurrent claimant terminates before completing it.
    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
  
  it('falla ante una firma inválida', async () => {
    (stripe.webhooks.constructEvent as any).mockImplementation(() => {
      throw new Error("Firma inválida");
    });
    
    const req = createMockRequest();
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    expect(db.paymentWebhookEvent.upsert).not.toHaveBeenCalled();
  });
});
