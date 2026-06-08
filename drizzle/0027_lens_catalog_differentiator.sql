ALTER TABLE "lens_catalog_items" ADD COLUMN "differentiator" varchar;

CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_technology" ON "lens_catalog_items" USING btree ("technology" text_ops);
CREATE INDEX IF NOT EXISTS "ix_lens_catalog_items_differentiator" ON "lens_catalog_items" USING btree ("differentiator" text_ops);
