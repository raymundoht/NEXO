-- LEGACY REFERENCE ONLY. Do not deploy this file directly.
-- The reproducible source of truth is prisma/schema.prisma plus
-- prisma/migrations; use `npm run db:migrate` on every environment.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WAREHOUSE', 'BUYER', 'CASHIER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'REJECTED', 'DISABLED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'ERROR', 'RETRY_REQUIRED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIPT', 'SALE', 'REFUND', 'INVENTORY_ADJUSTMENT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('HELD', 'COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CashMovementType" AS ENUM ('OPENING', 'SALE', 'REFUND', 'CASH_IN', 'CASH_OUT', 'CLOSING');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "first_failed_at" TIMESTAMPTZ(3),
    "locked_until" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_hash" CHAR(64),
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" BIGSERIAL NOT NULL,
    "normalized_email" VARCHAR(320) NOT NULL,
    "ip_hash" CHAR(64),
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_verifications" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CASHIER',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" CHAR(64),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "resend_at" TIMESTAMPTZ(3) NOT NULL,
    "last_sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "registration_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "sku" VARCHAR(80) NOT NULL,
    "barcode" VARCHAR(80),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'PZA',
    "category_id" UUID,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(14,4) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "current_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "min_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "max_stock" DECIMAL(14,3),
    "allow_negative" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "tax_id" VARCHAR(30),
    "email" VARCHAR(320),
    "phone" VARCHAR(40),
    "contact_name" VARCHAR(160),
    "address" TEXT,
    "credit_days" INTEGER NOT NULL DEFAULT 0,
    "delivery_days" INTEGER NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(14,2),
    "payment_terms" VARCHAR(300),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_products" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "supplier_sku" VARCHAR(80),
    "reference_cost" DECIMAL(14,4) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "lead_days" INTEGER NOT NULL DEFAULT 0,
    "is_preferred" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "folio" VARCHAR(40) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "exchange_rate" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "tax_total" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "expected_at" DATE,
    "notes" TEXT,
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_ordered" DECIMAL(14,3) NOT NULL,
    "quantity_received" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(14,4) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "line_subtotal" DECIMAL(14,2) NOT NULL,
    "line_tax" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" UUID NOT NULL,
    "receipt_number" VARCHAR(40) NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "received_by_id" UUID NOT NULL,
    "supplier_document" VARCHAR(100),
    "notes" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" UUID NOT NULL,
    "receipt_id" UUID NOT NULL,
    "purchase_order_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "stock_before" DECIMAL(14,3) NOT NULL,
    "stock_after" DECIMAL(14,3) NOT NULL,
    "unit_cost" DECIMAL(14,4),
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(80),
    "reason" VARCHAR(300),
    "idempotency_key" VARCHAR(100),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "folio" VARCHAR(40) NOT NULL,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" UUID NOT NULL,
    "completed_by_id" UUID,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" UUID NOT NULL,
    "inventory_count_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "system_quantity" DECIMAL(14,3) NOT NULL,
    "counted_quantity" DECIMAL(14,3),
    "difference" DECIMAL(14,3),
    "notes" VARCHAR(300),

    CONSTRAINT "inventory_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_registers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" UUID NOT NULL,
    "cash_register_id" UUID NOT NULL,
    "cashier_id" UUID NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "opening_amount" DECIMAL(14,2) NOT NULL,
    "expected_closing_amount" DECIMAL(14,2),
    "counted_closing_amount" DECIMAL(14,2),
    "difference" DECIMAL(14,2),
    "opening_denominations" JSONB,
    "closing_denominations" JSONB,
    "opened_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "notes" TEXT,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_movements" (
    "id" BIGSERIAL NOT NULL,
    "cash_session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(80),
    "notes" VARCHAR(300),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "folio" VARCHAR(40) NOT NULL,
    "cash_register_id" UUID,
    "cash_session_id" UUID,
    "cashier_id" UUID NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "customer_name" VARCHAR(160),
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "exchange_rate" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "payment_method" "PaymentMethod",
    "amount_tendered" DECIMAL(14,2),
    "change_amount" DECIMAL(14,2),
    "card_authorization" VARCHAR(80),
    "notes" TEXT,
    "held_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" UUID NOT NULL,
    "sale_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku_snapshot" VARCHAR(80) NOT NULL,
    "name_snapshot" VARCHAR(200) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,4) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(5,2) NOT NULL,
    "line_subtotal" DECIMAL(14,2) NOT NULL,
    "line_tax" DECIMAL(14,2) NOT NULL,
    "line_total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "folio" VARCHAR(40) NOT NULL,
    "sale_id" UUID NOT NULL,
    "approved_by_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "authorization_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_items" (
    "id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "sale_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "business_name" VARCHAR(180) NOT NULL DEFAULT 'NEXO ERP',
    "tax_id" VARCHAR(30),
    "address" TEXT,
    "phone" VARCHAR(40),
    "base_currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "allowed_currencies" TEXT[] DEFAULT ARRAY['MXN', 'USD']::TEXT[],
    "default_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 16,
    "max_cashier_discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "ticket_footer" VARCHAR(300),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "business_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "key" VARCHAR(40) NOT NULL,
    "prefix" VARCHAR(12) NOT NULL,
    "next_value" BIGINT NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80),
    "entity_id" VARCHAR(100),
    "ip_hash" CHAR(64),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

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

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_expires_at_idx" ON "sessions"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_attempts_normalized_email_created_at_idx" ON "auth_attempts"("normalized_email", "created_at");

-- CreateIndex
CREATE INDEX "auth_attempts_ip_hash_created_at_idx" ON "auth_attempts"("ip_hash", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "registration_verifications_email_key" ON "registration_verifications"("email");

-- CreateIndex
CREATE INDEX "registration_verifications_expires_at_idx" ON "registration_verifications"("expires_at");

-- CreateIndex
CREATE INDEX "registration_verifications_ip_hash_last_sent_at_idx" ON "registration_verifications"("ip_hash", "last_sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_status_current_stock_idx" ON "products"("status", "current_stock");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_legal_name_idx" ON "suppliers"("legal_name");

-- CreateIndex
CREATE INDEX "supplier_products_product_id_idx" ON "supplier_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplier_id_product_id_key" ON "supplier_products"("supplier_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_folio_key" ON "purchase_orders"("folio");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_created_at_idx" ON "purchase_orders"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "purchase_orders_status_expected_at_idx" ON "purchase_orders"("status", "expected_at");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_key" ON "purchase_order_items"("purchase_order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_receipt_number_key" ON "purchase_receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "purchase_receipts_purchase_order_id_received_at_idx" ON "purchase_receipts"("purchase_order_id", "received_at");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_product_id_idx" ON "purchase_receipt_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_items_receipt_id_purchase_order_item_id_key" ON "purchase_receipt_items"("receipt_id", "purchase_order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_idempotency_key_key" ON "stock_movements"("idempotency_key");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_created_at_idx" ON "stock_movements"("product_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_counts_folio_key" ON "inventory_counts"("folio");

-- CreateIndex
CREATE INDEX "inventory_counts_status_created_at_idx" ON "inventory_counts"("status", "created_at");

-- CreateIndex
CREATE INDEX "inventory_count_items_product_id_idx" ON "inventory_count_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_items_inventory_count_id_product_id_key" ON "inventory_count_items"("inventory_count_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_registers_code_key" ON "cash_registers"("code");

-- CreateIndex
CREATE INDEX "cash_sessions_cash_register_id_status_idx" ON "cash_sessions"("cash_register_id", "status");

-- CreateIndex
CREATE INDEX "cash_sessions_cashier_id_opened_at_idx" ON "cash_sessions"("cashier_id", "opened_at");

-- CreateIndex
CREATE INDEX "cash_movements_cash_session_id_created_at_idx" ON "cash_movements"("cash_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_folio_key" ON "sales"("folio");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sales_status_created_at_idx" ON "sales"("status", "created_at");

-- CreateIndex
CREATE INDEX "sales_cashier_id_created_at_idx" ON "sales"("cashier_id", "created_at");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_folio_key" ON "refunds"("folio");

-- CreateIndex
CREATE INDEX "refunds_sale_id_created_at_idx" ON "refunds"("sale_id", "created_at");

-- CreateIndex
CREATE INDEX "refund_items_product_id_idx" ON "refund_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_items_refund_id_sale_item_id_key" ON "refund_items"("refund_id", "sale_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_client_request_id_key" ON "payment_attempts"("client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_checkout_session_id_key" ON "payment_attempts"("checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_payment_intent_id_key" ON "payment_attempts"("payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_charge_id_key" ON "payment_attempts"("charge_id");

-- CreateIndex
CREATE INDEX "payment_attempts_sale_id_idx" ON "payment_attempts"("sale_id");

-- CreateIndex
CREATE INDEX "payment_attempts_checkout_session_id_idx" ON "payment_attempts"("checkout_session_id");

-- CreateIndex
CREATE INDEX "stock_reservations_product_id_expires_at_idx" ON "stock_reservations"("product_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_reservations_payment_attempt_id_product_id_key" ON "stock_reservations"("payment_attempt_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_stripe_event_id_key" ON "payment_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processing_status_locked_until_idx" ON "payment_webhook_events"("processing_status", "locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_stripe_refund_id_key" ON "payment_refunds"("stripe_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_idempotency_key_key" ON "payment_refunds"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_refunds_payment_attempt_id_idx" ON "payment_refunds"("payment_attempt_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_inventory_count_id_fkey" FOREIGN KEY ("inventory_count_id") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_items" ADD CONSTRAINT "inventory_count_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cash_register_id_fkey" FOREIGN KEY ("cash_register_id") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_cash_session_id_fkey" FOREIGN KEY ("cash_session_id") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
