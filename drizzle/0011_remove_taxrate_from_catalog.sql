-- Remove per-item taxRate columns from catalog tables.
-- Tax rate is now a global setting (settings.default_tax_rate).
-- Products, lenses, and supplier treatments only store isTaxable (boolean).
-- Existing sale/quote snapshots (snapshot_tax_rate) are NOT touched.

ALTER TABLE "products" DROP COLUMN "tax_rate";
ALTER TABLE "lens_catalog_items" DROP COLUMN "tax_rate";
ALTER TABLE "supplier_treatments" DROP COLUMN "tax_rate";
