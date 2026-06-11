-- ============================================================
-- Migration: 0028_heavy_bill_hollister
-- Safe data-preserving migration for lens_catalog_items refactor
-- ============================================================

-- 1. Create the new lens_type enum
--> statement-breakpoint
CREATE TYPE "public"."lens_type" AS ENUM('MONOFOCAL', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL');

-- 2. Create the new lens_technologies lookup table
--> statement-breakpoint
CREATE TABLE "lens_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"min_fitting_height" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. FK + indexes for lens_technologies
--> statement-breakpoint
ALTER TABLE "lens_technologies" ADD CONSTRAINT "lens_technologies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ix_lens_technologies_id" ON "lens_technologies" USING btree ("id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "ix_lens_technologies_supplier_id" ON "lens_technologies" USING btree ("supplier_id" uuid_ops);

-- ============================================================
-- SAFE DATA MIGRATION: lens_catalog_items
-- ============================================================

-- 4. type column: cast in-place from varchar to the new enum
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_type"; -- Limpieza de índice viejo
--> statement-breakpoint
-- upper(trim()) asegura que datos como 'monofocal ' o 'Monofocal' coincidan con el ENUM
ALTER TABLE "lens_catalog_items" ALTER COLUMN "type" SET DATA TYPE "public"."lens_type" USING upper(trim("type"))::"public"."lens_type";

-- 5. differentiator → differentiators (varchar → varchar[])
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_differentiator"; -- Limpieza de índice viejo
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ALTER COLUMN "differentiator" TYPE varchar[] USING CASE WHEN "differentiator" IS NOT NULL THEN ARRAY["differentiator"] ELSE NULL END;
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" RENAME COLUMN "differentiator" TO "differentiators";

-- 6. technology → technology_id (varchar → uuid FK)
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_technology"; -- Limpieza de índice viejo
--> statement-breakpoint
--    A. Seed lens_technologies with every unique (supplier_id, technology) pair
--> statement-breakpoint
INSERT INTO "lens_technologies" ("id", "supplier_id", "name", "is_active", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "supplier_id",
    "technology",
    true,
    now(),
    now()
FROM "lens_catalog_items"
WHERE "technology" IS NOT NULL
GROUP BY "supplier_id", "technology";

--    B. Add the new FK column (nullable — finished lenses have no digital design)
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "technology_id" uuid;

--    C. Back-fill technology_id by matching the old text to the newly inserted rows
--> statement-breakpoint
UPDATE "lens_catalog_items" lci
SET "technology_id" = lt."id"
FROM "lens_technologies" lt
WHERE lci."technology" = lt."name"
  AND lci."supplier_id" = lt."supplier_id";

--    D. Drop the now-redundant varchar column
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" DROP COLUMN "technology";

--    E. Add the FK constraint from technology_id → lens_technologies.id
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "public"."lens_technologies"("id") ON DELETE restrict ON UPDATE no action;

-- 7. New array columns (no existing data — safe to add as-is)
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "ar_colors" varchar[];
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "photochromic_colors" varchar[];

-- 8. Indexes for lens_catalog_items (new columns)
--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_technology_id" ON "lens_catalog_items" USING btree ("technology_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_differentiators" ON "lens_catalog_items" USING gin ("differentiators");
--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_ar_colors" ON "lens_catalog_items" USING gin ("ar_colors");
--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_photochromic_colors" ON "lens_catalog_items" USING gin ("photochromic_colors");

-- ============================================================
-- purchase_order_items / purchase_orders (unrelated columns)
-- ============================================================
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "unit_purchase_price_alt" double precision;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "source_currency" varchar(10) DEFAULT 'USD' NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "alt_rate" double precision;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN "unit_purchase_price_ves";
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN "prices_in_ves";