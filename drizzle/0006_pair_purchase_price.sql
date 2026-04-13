-- Add pair_purchase_price column with default 0
ALTER TABLE "lens_catalog_items" ADD COLUMN "pair_purchase_price" double precision NOT NULL DEFAULT 0;

-- Backfill existing records: UNIT → basePrice × 2, PAIR → basePrice
UPDATE "lens_catalog_items" SET
  "pair_purchase_price" = CASE
    WHEN "price_type" = 'UNIT' THEN "base_price" * 2
    ELSE "base_price"
  END;
