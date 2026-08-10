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
    }
  }
}));

vi.mock('@/lib/db', () => ({
  db: {
    paymentWebhookEvent: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
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
    (db.paymentWebhookEvent.create as any).mockResolvedValue({ id: 'evt_123' });
    (fulfillSaleOnce as any).mockResolvedValue(true);

    const req = createMockRequest();
    const res = await POST(req);

    expect(stripe.webhooks.constructEvent).toHaveBeenCalled();
    expect(db.paymentWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        stripeEventId: 'evt_123',
        eventType: 'checkout.session.completed'
      })
    });
    
    expect(fulfillSaleOnce).toHaveBeenCalledWith('attempt_1', 'cs_123', 'pi_123');
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
    (db.paymentWebhookEvent.create as any).mockRejectedValue(err);

    const req = createMockRequest();
    const res = await POST(req);

    expect(db.paymentWebhookEvent.create).toHaveBeenCalled();
    // It should NOT call fulfillSaleOnce because it was intercepted as duplicate
    expect(fulfillSaleOnce).not.toHaveBeenCalled();
    
    // Should return 200 to acknowledge Stripe and avoid retries for duplicate event
    expect(res.status).toBe(200);
  });
  
  it('falla ante una firma inválida', async () => {
    (stripe.webhooks.constructEvent as any).mockImplementation(() => {
      throw new Error("Firma inválida");
    });
    
    const req = createMockRequest();
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    expect(db.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });
});
