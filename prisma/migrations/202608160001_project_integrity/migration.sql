-- Reconcile fields that existed in Prisma or were patched manually but were
-- missing from the reproducible migration history.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "avatar_seed" VARCHAR(50);

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_idempotency_key_key"
  ON "stock_movements"("idempotency_key");

ALTER TABLE "business_settings"
  ADD COLUMN IF NOT EXISTS "accent_color" VARCHAR(7) NOT NULL DEFAULT '#2563eb',
  ADD COLUMN IF NOT EXISTS "accent_color_dark" VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS "sidebar_style" VARCHAR(10) NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS "border_radius" VARCHAR(5) NOT NULL DEFAULT 'md',
  ADD COLUMN IF NOT EXISTS "font_size" VARCHAR(5) NOT NULL DEFAULT 'sm',
  ADD COLUMN IF NOT EXISTS "font_family" VARCHAR(20) NOT NULL DEFAULT 'poppins',
  ADD COLUMN IF NOT EXISTS "density" VARCHAR(15) NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "favicon_url" VARCHAR(500);

-- Recovery codes now use an HMAC tied to the token id. Existing short-lived
-- SHA-256 codes are invalidated during the transition.
ALTER TABLE "password_reset_tokens"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
UPDATE "password_reset_tokens"
SET "used_at" = CURRENT_TIMESTAMP
WHERE "used_at" IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_attempts_check'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_attempts_check"
      CHECK ("attempts" >= 0 AND "attempts" <= 5);
  END IF;
END $$;

-- Stable snapshots keep historical purchase details unchanged when a product,
-- supplier or user is edited later.
ALTER TABLE "purchase_orders"
  ADD COLUMN IF NOT EXISTS "client_request_id" UUID,
  ADD COLUMN IF NOT EXISTS "supplier_code_snapshot" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "supplier_name_snapshot" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "buyer_name_snapshot" VARCHAR(160);

UPDATE "purchase_orders" AS po
SET
  "supplier_code_snapshot" = COALESCE(po."supplier_code_snapshot", s."code"),
  "supplier_name_snapshot" = COALESCE(po."supplier_name_snapshot", s."legal_name"),
  "buyer_name_snapshot" = COALESCE(po."buyer_name_snapshot", u."name")
FROM "suppliers" AS s, "users" AS u
WHERE po."supplier_id" = s."id" AND po."buyer_id" = u."id";

ALTER TABLE "purchase_orders"
  ALTER COLUMN "supplier_code_snapshot" SET NOT NULL,
  ALTER COLUMN "supplier_name_snapshot" SET NOT NULL,
  ALTER COLUMN "buyer_name_snapshot" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_client_request_id_key"
  ON "purchase_orders"("client_request_id");

ALTER TABLE "purchase_order_items"
  ADD COLUMN IF NOT EXISTS "sku_snapshot" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "name_snapshot" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "unit_snapshot" VARCHAR(20);

UPDATE "purchase_order_items" AS poi
SET
  "sku_snapshot" = COALESCE(poi."sku_snapshot", p."sku"),
  "name_snapshot" = COALESCE(poi."name_snapshot", p."name"),
  "unit_snapshot" = COALESCE(poi."unit_snapshot", p."unit")
FROM "products" AS p
WHERE poi."product_id" = p."id";

ALTER TABLE "purchase_order_items"
  ALTER COLUMN "sku_snapshot" SET NOT NULL,
  ALTER COLUMN "name_snapshot" SET NOT NULL,
  ALTER COLUMN "unit_snapshot" SET NOT NULL;

ALTER TABLE "purchase_receipts"
  ADD COLUMN IF NOT EXISTS "client_request_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_receipts_client_request_id_key"
  ON "purchase_receipts"("client_request_id");

ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "client_request_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "sales_client_request_id_key"
  ON "sales"("client_request_id");

ALTER TABLE "sale_items"
  ADD COLUMN IF NOT EXISTS "unit_cost_snapshot" DECIMAL(14,4);
UPDATE "sale_items" AS si
SET "unit_cost_snapshot" = p."cost"
FROM "products" AS p
WHERE si."product_id" = p."id" AND si."unit_cost_snapshot" IS NULL;
ALTER TABLE "sale_items"
  ALTER COLUMN "unit_cost_snapshot" SET NOT NULL;

ALTER TABLE "refunds"
  ADD COLUMN IF NOT EXISTS "client_request_id" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_client_request_id_key"
  ON "refunds"("client_request_id");

ALTER TABLE "cash_movements"
  ADD COLUMN IF NOT EXISTS "idempotency_key" VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_idempotency_key_key"
  ON "cash_movements"("idempotency_key");

-- Link provider refunds to the local commercial refund and retain the exact
-- requested lines so a successful provider operation can be finalized safely.
ALTER TABLE "payment_refunds"
  ADD COLUMN IF NOT EXISTS "refund_id" UUID,
  ADD COLUMN IF NOT EXISTS "requested_items" JSONB,
  ADD COLUMN IF NOT EXISTS "mode" VARCHAR(10) NOT NULL DEFAULT 'REFUND';
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refunds_refund_id_key"
  ON "payment_refunds"("refund_id");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_refunds_refund_id_fkey'
  ) THEN
    ALTER TABLE "payment_refunds"
      ADD CONSTRAINT "payment_refunds_refund_id_fkey"
      FOREIGN KEY ("refund_id") REFERENCES "refunds"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
