-- Add source_currency and alt_rate columns to purchase_orders
ALTER TABLE "purchase_orders" ADD COLUMN "source_currency" varchar(10) NOT NULL DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "alt_rate" double precision;--> statement-breakpoint

-- Migrate existing VES orders
UPDATE "purchase_orders" SET "source_currency" = 'VES' WHERE "prices_in_ves" = true;--> statement-breakpoint

-- Drop the old boolean column
ALTER TABLE "purchase_orders" DROP COLUMN "prices_in_ves";--> statement-breakpoint

-- Rename the alt-currency price column on items
ALTER TABLE "purchase_order_items" RENAME COLUMN "unit_purchase_price_ves" TO "unit_purchase_price_alt";
