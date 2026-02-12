-- Add lens catalog features: blue cut, anti-reflective, and sale price
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "is_blue_cut" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "is_ar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN IF NOT EXISTS "sale_price" double precision;
