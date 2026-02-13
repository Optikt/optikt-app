-- Migration: Create lens_optical_ranges table and drop optical columns from lens_catalog_items
-- Each lens catalog item can have multiple optical ranges (sphere, cylinder, addition)

CREATE TABLE IF NOT EXISTS "lens_optical_ranges" (
    "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
    "lens_catalog_item_id" uuid NOT NULL,
    "sphere_min" double precision NOT NULL,
    "sphere_max" double precision NOT NULL,
    "cylinder_min" double precision,
    "cylinder_max" double precision,
    "addition_min" double precision,
    "addition_max" double precision,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Foreign key: cascade delete when parent lens catalog item is deleted
ALTER TABLE "lens_optical_ranges"
    ADD CONSTRAINT "lens_optical_ranges_item_id_fkey"
    FOREIGN KEY ("lens_catalog_item_id")
    REFERENCES "lens_catalog_items"("id")
    ON DELETE CASCADE;

-- B-tree indexes for lookups
CREATE INDEX "ix_lens_optical_ranges_id"
    ON "lens_optical_ranges" USING btree ("id" ASC NULLS LAST);

CREATE INDEX "ix_lens_optical_ranges_item_id"
    ON "lens_optical_ranges" USING btree ("lens_catalog_item_id" ASC NULLS LAST);

-- GiST expression index for sphere containment queries: numrange(sphere_min, sphere_max, '[]') @> value
CREATE INDEX "ix_lens_optical_ranges_sphere_range"
    ON "lens_optical_ranges" USING gist (numrange(sphere_min::numeric, sphere_max::numeric, '[]'));

-- GiST expression index for cylinder containment queries
CREATE INDEX "ix_lens_optical_ranges_cylinder_range"
    ON "lens_optical_ranges" USING gist (numrange(cylinder_min::numeric, cylinder_max::numeric, '[]'));

-- Drop old optical range columns from lens_catalog_items (start fresh)
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "sphere_min";
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "sphere_max";
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "cylinder_min";
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "cylinder_max";
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "addition_min";
ALTER TABLE "lens_catalog_items" DROP COLUMN IF EXISTS "addition_max";
