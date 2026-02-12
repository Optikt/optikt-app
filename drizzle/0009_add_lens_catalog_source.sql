-- Add lens catalog source enum type and column
CREATE TYPE lens_catalog_source AS ENUM ('FINISHED', 'LAB');

ALTER TABLE lens_catalog_items
  ADD COLUMN source lens_catalog_source NOT NULL DEFAULT 'LAB';
