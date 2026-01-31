-- Migration: Create unified materials table
-- This replaces the lens_materials reference in products with a new unified materials table

-- Step 1: Create the new materials table
CREATE TABLE IF NOT EXISTS "materials" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar NOT NULL,
    "code" varchar NOT NULL,
    "product_type" varchar(20) NOT NULL,
    "refractive_index" double precision,
    "description" varchar,
    "is_active" boolean DEFAULT true NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS "ix_materials_id" ON "materials" USING btree ("id");
CREATE INDEX IF NOT EXISTS "ix_materials_product_type" ON "materials" USING btree ("product_type");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_materials_name_product_type" ON "materials" USING btree ("name", "product_type");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_materials_code" ON "materials" USING btree ("code");

-- Step 3: Migrate existing lens_materials to the new materials table (as LENS type)
INSERT INTO "materials" ("id", "name", "code", "product_type", "refractive_index", "description", "is_active", "deleted_at", "created_at", "updated_at")
SELECT "id", "name", "code", 'LENS', "refractive_index", "description", "is_active", "deleted_at", "created_at", "updated_at"
FROM "lens_materials"
ON CONFLICT DO NOTHING;

-- Step 4: Add common frame materials
INSERT INTO "materials" ("name", "code", "product_type", "description", "is_active") VALUES
    ('Titanio', 'TITANIO', 'FRAME', 'Material ligero y resistente a la corrosión', true),
    ('Acetato', 'ACETATO', 'FRAME', 'Plástico derivado de celulosa, hipoalergénico', true),
    ('TR90', 'TR90', 'FRAME', 'Polímero termoplástico flexible y resistente', true),
    ('Metal', 'METAL', 'FRAME', 'Aleación metálica estándar', true),
    ('Acero Inoxidable', 'ACERO', 'FRAME', 'Acero inoxidable resistente', true),
    ('Aluminio', 'ALUMINIO', 'FRAME', 'Aluminio ligero', true),
    ('Madera', 'MADERA', 'FRAME', 'Madera natural o laminada', true),
    ('Carbono', 'CARBONO', 'FRAME', 'Fibra de carbono ultraligera', true),
    ('Policarbonato', 'PC_FRAME', 'FRAME', 'Plástico resistente a impactos', true)
ON CONFLICT DO NOTHING;

-- Step 5: Drop the old foreign key from products to lens_materials (if exists)
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_material_id_fkey";

-- Step 6: Add new foreign key from products to materials
ALTER TABLE "products" ADD CONSTRAINT "products_material_id_fkey" 
    FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL;

-- Note: We keep lens_materials table for now as lens_catalog_items still references it.
-- In a future migration, we can update lens_catalog_items to use the materials table
-- and then drop lens_materials.
