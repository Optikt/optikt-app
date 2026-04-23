DROP INDEX "ix_materials_code";--> statement-breakpoint
CREATE UNIQUE INDEX "ix_materials_code_product_type" ON "materials" USING btree ("code" text_ops,"product_type" text_ops);