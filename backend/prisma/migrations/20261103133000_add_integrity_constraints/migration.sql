-- Integrity constraints for GEARHUB.
-- Every rule here already matches what the API writes; this makes the database enforce it too.
-- Before applying, run backend/prisma/check-before-migrate.sql and make sure it returns 0 everywhere.

-- 1. Fill the two defaulted columns that were allowed to be NULL (harmless backfill)
UPDATE "users"  SET "is_admin"   = false             WHERE "is_admin"   IS NULL;
UPDATE "users"  SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;
UPDATE "orders" SET "created_at" = CURRENT_TIMESTAMP WHERE "created_at" IS NULL;

-- 2. Required columns (orders.user_id stays nullable: guest checkout)
ALTER TABLE "users"       ALTER COLUMN "is_admin"   SET NOT NULL;
ALTER TABLE "users"       ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "orders"      ALTER COLUMN "created_at" SET NOT NULL;
ALTER TABLE "cart_items"  ALTER COLUMN "user_id"    SET NOT NULL;
ALTER TABLE "cart_items"  ALTER COLUMN "product_id" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "order_id"   SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "product_id" SET NOT NULL;

-- 3. Domain rules (Prisma's schema language can't express CHECK, so they live here)
ALTER TABLE "products"    ADD CONSTRAINT "products_price_check"          CHECK ("price" >= 0);
ALTER TABLE "products"    ADD CONSTRAINT "products_stock_quantity_check" CHECK ("stock_quantity" >= 0);
ALTER TABLE "cart_items"  ADD CONSTRAINT "cart_items_quantity_check"     CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check"    CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_check"  CHECK ("unit_price" >= 0);
ALTER TABLE "orders"      ADD CONSTRAINT "orders_status_check"
  CHECK ("status" IN ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'));
ALTER TABLE "orders"      ADD CONSTRAINT "orders_payment_method_check"
  CHECK ("payment_method" IS NULL OR "payment_method" IN ('cod', 'xendit'));

-- 4. Indexes on foreign keys (Postgres doesn't create these automatically)
CREATE INDEX "cart_items_product_id_idx"  ON "cart_items"("product_id");
CREATE INDEX "orders_user_id_idx"         ON "orders"("user_id");
CREATE INDEX "order_items_order_id_idx"   ON "order_items"("order_id");
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");
