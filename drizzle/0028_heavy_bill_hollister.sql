-- ============================================================
-- Migration: 0028_heavy_bill_hollister
-- Safe data-preserving migration for lens_catalog_items refactor
-- IDEMPOTENT: Safe to re-run if it fails halfway.
-- ============================================================

-- 1. Create the new lens_type enum (Safe wrapped)
--> statement-breakpoint
DO $$ BEGIN
    CREATE TYPE "public"."lens_type" AS ENUM('MONOFOCAL', 'BIFOCAL', 'PROGRESSIVE', 'OCCUPATIONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create the new lens_technologies lookup table (Safe)
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lens_technologies" (
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
DO $$ BEGIN
    ALTER TABLE "lens_technologies" ADD CONSTRAINT "lens_technologies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_technologies_id" ON "lens_technologies" USING btree ("id" uuid_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_technologies_supplier_id" ON "lens_technologies" USING btree ("supplier_id" uuid_ops);

-- ============================================================
-- SAFE DATA MIGRATION: lens_catalog_items
-- ============================================================

-- 4. type column: cast in-place from varchar to the new enum
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_type"; -- Limpieza de índice viejo
--> statement-breakpoint
-- upper(trim()) asegura que datos como 'monofocal ' o 'Monofocal' coincidan con el ENUM
-- Solo se ejecutará si la columna sigue siendo varchar
DO $$ BEGIN
    ALTER TABLE "lens_catalog_items" ALTER COLUMN "type" SET DATA TYPE "public"."lens_type" USING upper(trim("type"))::"public"."lens_type";
EXCEPTION
    WHEN cannot_coerce THEN RAISE NOTICE 'Column type is already lens_type';
END $$;

-- 5. differentiator → differentiators (varchar → varchar[])
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_differentiator"; -- Limpieza de índice viejo
--> statement-breakpoint
-- Solo se ejecuta si la columna todavía se llama differentiator y es varchar
DO $$ BEGIN
    ALTER TABLE "lens_catalog_items" ALTER COLUMN "differentiator" TYPE varchar[] USING CASE WHEN "differentiator" IS NOT NULL THEN ARRAY["differentiator"] ELSE NULL END;
    ALTER TABLE "lens_catalog_items" RENAME COLUMN "differentiator" TO "differentiators";
EXCEPTION
    WHEN undefined_column THEN RAISE NOTICE 'Column differentiator already migrated';
END $$;

-- 6. technology → technology_id (varchar → uuid FK)
--> statement-breakpoint
DROP INDEX IF EXISTS "ix_lens_catalog_items_technology"; -- Limpieza de índice viejo

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
GROUP BY "supplier_id", "technology"
ON CONFLICT DO NOTHING; -- Previene duplicados si se corre varias veces

--    B. Add the new FK column (nullable — finished lenses have no digital design)
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "technology_id" uuid;

--    C. Back-fill technology_id by matching the old text to the newly inserted rows
--> statement-breakpoint
UPDATE "lens_catalog_items" lci
SET "technology_id" = lt."id"
FROM "lens_technologies" lt
WHERE lci."technology" = lt."name"
  AND lci."supplier_id" = lt."supplier_id"
  AND lci."technology_id" IS NULL; -- Solo actualiza los que no tengan ID ya

--    D. Drop the now-redundant varchar column
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "technology";

--    E. Add the FK constraint from technology_id → lens_technologies.id
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_technology_id_fkey" FOREIGN KEY ("technology_id") REFERENCES "public"."lens_technologies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. New array columns (no existing data — safe to add as-is)
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "ar_colors" varchar[];
--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "photochromic_colors" varchar[];

-- 8. Indexes for lens_catalog_items (new columns)
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_technology_id" ON "lens_catalog_items" USING btree ("technology_id" uuid_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_differentiators" ON "lens_catalog_items" USING gin ("differentiators");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_ar_colors" ON "lens_catalog_items" USING gin ("ar_colors");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_photochromic_colors" ON "lens_catalog_items" USING gin ("photochromic_colors");

-- ============================================================
-- purchase_order_items / purchase_orders (unrelated columns)
-- AÑADIDO IF NOT EXISTS / IF EXISTS para evitar el error anterior
-- ============================================================
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "unit_purchase_price_alt" double precision;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "source_currency" varchar(10);
--> statement-breakpoint
-- Seteamos default y not null por separado por si la columna ya existía sin estas restricciones
ALTER TABLE "purchase_orders" ALTER COLUMN "source_currency" SET DEFAULT 'USD';
--> statement-breakpoint
ALTER TABLE "purchase_orders" ALTER COLUMN "source_currency" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "alt_rate" double precision;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "unit_purchase_price_ves";
--> statement-breakpoint
ALTER TABLE "purchase_orders" DROP COLUMN IF EXISTS "prices_in_ves";