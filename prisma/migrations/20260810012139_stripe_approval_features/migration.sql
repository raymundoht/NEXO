-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR', 'RETRY_REQUIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "UserStatus" ADD VALUE 'REJECTED';
ALTER TYPE "UserStatus" ADD VALUE 'DISABLED';

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "client_request_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL DEFAULT 'STRIPE',
    "environment" VARCHAR(10) NOT NULL DEFAULT 'TEST',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "expected_amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "checkout_session_id" VARCHAR(200),
    "payment_intent_id" VARCHAR(200),
    "charge_id" VARCHAR(200),
    "cashier_id" UUID NOT NULL,
    "cash_register_id" UUID NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "card_brand" VARCHAR(30),
    "card_last4" CHAR(4),
    "reason_code" VARCHAR(50),
    "error_code" VARCHAR(50),
    "error_message" VARCHAR(500),
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_pa_currency" CHECK (currency = 'MXN'),
    CONSTRAINT "chk_pa_amount" CHECK (expected_amount > 0),
    CONSTRAINT "chk_pa_provider" CHECK (provider = 'STRIPE'),
    CONSTRAINT "chk_pa_env" CHECK (environment = 'TEST')
);

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_sr_quantity" CHECK (quantity > 0),
    CONSTRAINT "chk_sr_consume_release" CHECK (consumed_at IS NULL OR released_at IS NULL)
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL,
    "stripe_event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "stripe_object_id" VARCHAR(200),
    "processing_status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" VARCHAR(500),
    "locked_until" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "stripe_refund_id" VARCHAR(200),
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(300) NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "error" VARCHAR(500),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_pr_amount" CHECK (amount > 0),
    CONSTRAINT "chk_pr_currency" CHECK (currency = 'MXN')
);

-- Add ForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create Indexes
CREATE UNIQUE INDEX "payment_attempts_client_request_id_key" ON "payment_attempts"("client_request_id");
CREATE UNIQUE INDEX "payment_attempts_checkout_session_id_key" ON "payment_attempts"("checkout_session_id");
CREATE UNIQUE INDEX "payment_attempts_payment_intent_id_key" ON "payment_attempts"("payment_intent_id");
CREATE UNIQUE INDEX "payment_attempts_charge_id_key" ON "payment_attempts"("charge_id");
CREATE INDEX "payment_attempts_sale_id_idx" ON "payment_attempts"("sale_id");
CREATE INDEX "payment_attempts_checkout_session_id_idx" ON "payment_attempts"("checkout_session_id");

-- Partial Unique Index para prevenir duplicados en ventas
CREATE UNIQUE INDEX "payment_attempts_sale_id_active_idx" ON "payment_attempts"("sale_id") WHERE "status" IN ('PENDING', 'PROCESSING', 'REVIEW_REQUIRED', 'SUCCEEDED');

CREATE INDEX "stock_reservations_product_id_expires_at_idx" ON "stock_reservations"("product_id", "expires_at");
CREATE UNIQUE INDEX "stock_reservations_payment_attempt_id_product_id_key" ON "stock_reservations"("payment_attempt_id", "product_id");
CREATE UNIQUE INDEX "payment_webhook_events_stripe_event_id_key" ON "payment_webhook_events"("stripe_event_id");
CREATE INDEX "payment_webhook_events_processing_status_locked_until_idx" ON "payment_webhook_events"("processing_status", "locked_until");
CREATE UNIQUE INDEX "payment_refunds_stripe_refund_id_key" ON "payment_refunds"("stripe_refund_id");
CREATE UNIQUE INDEX "payment_refunds_idempotency_key_key" ON "payment_refunds"("idempotency_key");
CREATE INDEX "payment_refunds_payment_attempt_id_idx" ON "payment_refunds"("payment_attempt_id");

-- Security and Roles (RLS)
ALTER TABLE "payment_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_refunds" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "payment_attempts" FROM anon, authenticated;
REVOKE ALL ON "stock_reservations" FROM anon, authenticated;
REVOKE ALL ON "payment_webhook_events" FROM anon, authenticated;
REVOKE ALL ON "payment_refunds" FROM anon, authenticated;

-- Since the backend uses Prisma, it usually runs as postgres or a specific role.
-- We grant to authenticated and service_role generally if it's Supabase, or nexo_backend as requested.
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nexo_backend') THEN
        GRANT ALL ON "payment_attempts" TO nexo_backend;
        GRANT ALL ON "stock_reservations" TO nexo_backend;
        GRANT ALL ON "payment_webhook_events" TO nexo_backend;
        GRANT ALL ON "payment_refunds" TO nexo_backend;
    END IF;
END $$;
