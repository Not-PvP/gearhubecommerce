-- Split orders.shipping_address (JSON text) into real columns, store the Xendit invoice id,
-- and add one more integrity rule on order_items.
-- Existing orders are converted; rows that were not valid JSON keep their text in "street".

-- 0. Stop early, with a clear message, if existing data would break a new rule
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "order_items" GROUP BY "order_id", "product_id" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'order_items has duplicate (order_id, product_id) rows. Merge them before applying this migration.';
  END IF;
END $$;

-- 1. New columns (nullable for now so existing rows can be filled in)
ALTER TABLE "orders"
  ADD COLUMN "full_name"         VARCHAR(255),
  ADD COLUMN "phone"             VARCHAR(20),
  ADD COLUMN "street"            TEXT,
  ADD COLUMN "city"              VARCHAR(100),
  ADD COLUMN "province"          VARCHAR(100),
  ADD COLUMN "postal_code"       VARCHAR(10),
  ADD COLUMN "xendit_invoice_id" VARCHAR(100);

-- 2. Fill the new columns from the old JSON text (anything missing or unreadable becomes 'Unknown')
DO $$
DECLARE
  r RECORD;
  j jsonb;
BEGIN
  FOR r IN SELECT "id", "shipping_address" FROM "orders" LOOP
    j := NULL;
    BEGIN
      j := r."shipping_address"::jsonb;
      IF jsonb_typeof(j) <> 'object' THEN
        j := NULL;
      END IF;
    EXCEPTION WHEN others THEN
      j := NULL;
    END;

    UPDATE "orders" SET
      "full_name"   = COALESCE(NULLIF(left(btrim(j ->> 'fullName'), 255), ''), 'Unknown'),
      "phone"       = COALESCE(NULLIF(left(btrim(j ->> 'phone'), 20), ''), 'Unknown'),
      "street"      = CASE
                        WHEN j IS NULL THEN COALESCE(NULLIF(btrim(r."shipping_address"), ''), 'Unknown')
                        ELSE COALESCE(NULLIF(btrim(j ->> 'street'), ''), 'Unknown')
                      END,
      "city"        = COALESCE(NULLIF(left(btrim(j ->> 'city'), 100), ''), 'Unknown'),
      "province"    = COALESCE(NULLIF(left(btrim(j ->> 'province'), 100), ''), 'Unknown'),
      "postal_code" = COALESCE(NULLIF(left(btrim(j ->> 'postalCode'), 10), ''), 'Unknown')
    WHERE "id" = r."id";
  END LOOP;
END $$;

-- 3. The address columns are required
ALTER TABLE "orders"
  ALTER COLUMN "full_name"   SET NOT NULL,
  ALTER COLUMN "phone"       SET NOT NULL,
  ALTER COLUMN "street"      SET NOT NULL,
  ALTER COLUMN "city"        SET NOT NULL,
  ALTER COLUMN "province"    SET NOT NULL,
  ALTER COLUMN "postal_code" SET NOT NULL;

-- 4. The old JSON column is no longer needed
ALTER TABLE "orders" DROP COLUMN "shipping_address";

-- 5. One Xendit invoice can pay for only one order (it stays NULL for cash on delivery)
CREATE UNIQUE INDEX "orders_xendit_invoice_id_key" ON "orders"("xendit_invoice_id");

-- 6. A product appears at most once in an order
CREATE UNIQUE INDEX "order_items_order_id_product_id_key" ON "order_items"("order_id", "product_id");
