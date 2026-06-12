-- ============================================================
-- Migration: 0029_gifted_skrulls
-- Make lens_technologies.supplier_id nullable (hybrid model)
-- Consolidate duplicate "Convencional" technologies into one global row
-- IDEMPOTENT: Safe to re-run if it fails halfway.
-- ============================================================

-- 1. Drop existing FK constraint before altering column
--> statement-breakpoint
ALTER TABLE "lens_technologies" DROP CONSTRAINT IF EXISTS "lens_technologies_supplier_id_fkey";

-- 2. Make supplier_id nullable
--> statement-breakpoint
ALTER TABLE "lens_technologies" ALTER COLUMN "supplier_id" DROP NOT NULL;

-- 3. Re-create FK with ON DELETE SET NULL
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "lens_technologies" ADD CONSTRAINT "lens_technologies_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

-- 4. Create a unified global "Convencional" technology if it doesn't exist
--> statement-breakpoint
INSERT INTO "lens_technologies" ("id", "supplier_id", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), NULL, 'Convencional', true, now(), now()
WHERE NOT EXISTS (
	SELECT 1 FROM "lens_technologies" WHERE "name" = 'Convencional' AND "supplier_id" IS NULL
);

-- 5. Migrate lens_catalog_items that point to supplier-specific "Convencional"
--    rows to the new global one
--> statement-breakpoint
UPDATE "lens_catalog_items" lci
SET "technology_id" = lt_global."id"
FROM "lens_technologies" lt_old
JOIN "lens_technologies" lt_global ON lt_global."name" = lt_old."name" AND lt_global."supplier_id" IS NULL
WHERE lci."technology_id" = lt_old."id"
  AND lt_old."name" = 'Convencional'
  AND lt_old."supplier_id" IS NOT NULL;

-- 6. Delete the now-redundant supplier-specific "Convencional" rows
--> statement-breakpoint
DELETE FROM "lens_technologies"
WHERE "name" = 'Convencional' AND "supplier_id" IS NOT NULL;
