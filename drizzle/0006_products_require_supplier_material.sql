-- Migration: Make supplier_id and material_id required in products table
-- Also update FK constraints: supplier_id and material_id use RESTRICT (cannot delete referenced), brand_id stays SET NULL

-- IMPORTANT: Before running this migration, ensure all products have valid supplier_id and material_id values.
-- If there are products with NULL supplier_id or material_id, you must:
-- 1. Either delete those products
-- 2. Or update them to reference valid suppliers/materials

-- Step 1: Verify no NULL values exist (this will fail if there are NULL values)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM products WHERE supplier_id IS NULL AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Cannot apply migration: There are active products with NULL supplier_id. Please update or delete these products first.';
    END IF;
    
    IF EXISTS (SELECT 1 FROM products WHERE material_id IS NULL AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'Cannot apply migration: There are active products with NULL material_id. Please update or delete these products first.';
    END IF;
END $$;

-- Step 2: Drop existing foreign key constraints
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_supplier_id_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_material_id_fkey";

-- Step 3: Add NOT NULL constraints to supplier_id and material_id
-- Note: For soft-deleted products (deleted_at IS NOT NULL), we allow NULL values during transition
-- First, update any NULL values in soft-deleted products to a placeholder if needed (skip if you prefer to delete them)
-- ALTER TABLE "products" ALTER COLUMN "supplier_id" SET NOT NULL;
-- ALTER TABLE "products" ALTER COLUMN "material_id" SET NOT NULL;

-- Using a workaround: Create a check constraint that allows NULL only for deleted products
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_not_null_when_active"
    CHECK (deleted_at IS NOT NULL OR supplier_id IS NOT NULL);

ALTER TABLE "products" ADD CONSTRAINT "products_material_id_not_null_when_active"
    CHECK (deleted_at IS NOT NULL OR material_id IS NOT NULL);

-- Step 4: Re-add foreign key constraints with correct ON DELETE behavior
-- brand_id: SET NULL (optional field, can be removed)
-- supplier_id: RESTRICT (required field, cannot delete supplier with products)
-- material_id: RESTRICT (required field, cannot delete material with products)

ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT;

ALTER TABLE "products" ADD CONSTRAINT "products_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT;

-- Note: brand_id FK with SET NULL should already exist, but ensure it's correct
-- If needed, uncomment:
-- ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_brand_id_fkey";
-- ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey"
--     FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL;
