-- Add FREE_ITEM to the sale_item_type enum
-- NOTE: PostgreSQL enum ADD VALUE is non-transactional; cannot be run inside a multi-statement tx.
ALTER TYPE "sale_item_type" ADD VALUE IF NOT EXISTS 'FREE_ITEM';--> statement-breakpoint

-- Create free_item_category enum (idempotent)
DO $$ BEGIN
CREATE TYPE "free_item_category" AS ENUM('CONTACT_LENS_FORMULA', 'CONTACT_LENS_COSMETIC', 'INTRAOCULAR_LENS', 'SERVICE', 'OTHER');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Create free_item_enrichment_status enum (idempotent)
DO $$ BEGIN
CREATE TYPE "free_item_enrichment_status" AS ENUM('PENDING', 'ENRICHED');
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Create sale_item_free_details table (1:1 extension of sale_items for FREE_ITEM rows)
CREATE TABLE IF NOT EXISTS "sale_item_free_details" (
"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
"sale_item_id" uuid NOT NULL UNIQUE,
"category" "free_item_category" NOT NULL,
"description" varchar(500) NOT NULL,
"enrichment_status" "free_item_enrichment_status" NOT NULL DEFAULT 'PENDING',
"unit_cost" double precision,
"supplier_id" uuid,
"optical_notes" varchar(1000),
"enriched_at" timestamp with time zone,
"enriched_by_id" uuid,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Create quote_item_free_details table (1:1 extension of quote_items for FREE_ITEM rows)
CREATE TABLE IF NOT EXISTS "quote_item_free_details" (
"id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
"quote_item_id" uuid NOT NULL UNIQUE,
"category" "free_item_category" NOT NULL,
"description" varchar(500) NOT NULL,
"enrichment_status" "free_item_enrichment_status" NOT NULL DEFAULT 'PENDING',
"unit_cost" double precision,
"supplier_id" uuid,
"optical_notes" varchar(1000),
"enriched_at" timestamp with time zone,
"enriched_by_id" uuid,
"created_at" timestamp with time zone NOT NULL DEFAULT now(),
"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "ix_sale_item_free_details_sale_item_id" ON "sale_item_free_details" USING btree ("sale_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_quote_item_free_details_quote_item_id" ON "quote_item_free_details" USING btree ("quote_item_id" uuid_ops);--> statement-breakpoint

-- Foreign keys (idempotent)
DO $$ BEGIN
ALTER TABLE "sale_item_free_details" ADD CONSTRAINT "sale_item_free_details_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
ALTER TABLE "sale_item_free_details" ADD CONSTRAINT "sale_item_free_details_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
ALTER TABLE "sale_item_free_details" ADD CONSTRAINT "sale_item_free_details_enriched_by_id_fkey" FOREIGN KEY ("enriched_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
ALTER TABLE "quote_item_free_details" ADD CONSTRAINT "quote_item_free_details_quote_item_id_fkey" FOREIGN KEY ("quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
ALTER TABLE "quote_item_free_details" ADD CONSTRAINT "quote_item_free_details_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

DO $$ BEGIN
ALTER TABLE "quote_item_free_details" ADD CONSTRAINT "quote_item_free_details_enriched_by_id_fkey" FOREIGN KEY ("enriched_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
