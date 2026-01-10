-- Brand name partial unique index
-- Only enforces uniqueness on non-deleted brands

-- Drop existing unique index
DROP INDEX IF EXISTS ix_brands_name;

-- Create partial unique index (only for non-deleted brands)
CREATE UNIQUE INDEX ix_brands_name ON brands (name) WHERE deleted_at IS NULL;
