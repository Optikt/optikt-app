-- Create currencies table
CREATE TABLE IF NOT EXISTS "currencies" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"symbol" varchar NOT NULL DEFAULT '$',
	"is_base" boolean NOT NULL DEFAULT false,
	"is_active" boolean NOT NULL DEFAULT true,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create exchange_rates table
CREATE TABLE IF NOT EXISTS "exchange_rates" (
	"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
	"currency_id" uuid NOT NULL,
	"rate_to_ves" double precision NOT NULL,
	"effective_date" date NOT NULL,
	"source" varchar NOT NULL DEFAULT 'manual',
	"notes" varchar,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Currencies indexes
CREATE UNIQUE INDEX IF NOT EXISTS "ix_currencies_code" ON "currencies" USING btree ("code" text_ops ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS "ix_currencies_id" ON "currencies" USING btree ("id" uuid_ops ASC NULLS LAST);

-- Exchange rates indexes
CREATE INDEX IF NOT EXISTS "ix_exchange_rates_id" ON "exchange_rates" USING btree ("id" uuid_ops ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS "ix_exchange_rates_currency_id" ON "exchange_rates" USING btree ("currency_id" uuid_ops ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS "ix_exchange_rates_effective_date" ON "exchange_rates" USING btree ("effective_date" date_ops DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS "ix_exchange_rates_currency_date" ON "exchange_rates" USING btree ("currency_id" uuid_ops ASC NULLS LAST, "effective_date" date_ops ASC NULLS LAST);

-- Add purchase currency fields to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_currency" varchar;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_currency_rate" double precision;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_usd_bcv_rate" double precision;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "purchase_date" date;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "normalized_cost_usd" double precision;

-- Add default currency to suppliers
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "default_currency" varchar;

-- Seed default currencies
INSERT INTO "currencies" ("code", "name", "symbol", "is_base", "is_active")
VALUES
	('USD_BCV', 'Dólar BCV', '$', true, true),
	('EUR_BCV', 'Euro BCV', '€', false, true),
	('USDT', 'USDT', '$', false, true),
	('USD_PAYPAL', 'USD PayPal', '$', false, true)
ON CONFLICT DO NOTHING;

-- Migrate existing products: set default values for existing rows
-- Assumes existing prices were in USD_BCV
UPDATE "products"
SET
	"purchase_currency" = 'USD_BCV',
	"purchase_currency_rate" = 1,
	"purchase_usd_bcv_rate" = 1,
	"purchase_date" = CAST("created_at" AS date),
	"normalized_cost_usd" = "purchase_price"
WHERE "purchase_currency" IS NULL;
