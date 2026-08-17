CREATE UNIQUE INDEX IF NOT EXISTS "supplier_products_one_preferred_per_product"
  ON "supplier_products"("product_id")
  WHERE "is_preferred" = true;

ALTER TABLE "supplier_products"
  ADD CONSTRAINT "supplier_products_reference_cost_check"
  CHECK ("reference_cost" >= 0),
  ADD CONSTRAINT "supplier_products_lead_days_check"
  CHECK ("lead_days" >= 0);
