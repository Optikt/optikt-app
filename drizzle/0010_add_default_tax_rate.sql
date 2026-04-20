-- Migration: Add default_tax_rate to settings
ALTER TABLE settings ADD COLUMN default_tax_rate double precision NOT NULL DEFAULT 16;
