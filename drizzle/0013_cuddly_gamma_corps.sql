ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "is_reviewed" boolean DEFAULT false NOT NULL;
