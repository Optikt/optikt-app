ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lens_width" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bridge_width" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "temple_length" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "base_curve" double precision;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "diameter" double precision;