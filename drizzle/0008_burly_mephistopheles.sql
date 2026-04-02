ALTER TABLE "quotes" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::text;--> statement-breakpoint
DROP TYPE "public"."quote_status";--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'CONVERTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."quote_status";--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "status" SET DATA TYPE "public"."quote_status" USING "status"::"public"."quote_status";--> statement-breakpoint
ALTER TABLE "supplier_treatments" ADD COLUMN "sale_price" double precision;--> statement-breakpoint
ALTER TABLE "supplier_treatments" ADD COLUMN "is_taxable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_treatments" ADD COLUMN "tax_rate" double precision DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_taxable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate" double precision DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "is_taxable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "tax_rate" double precision DEFAULT 16 NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_is_taxable" boolean;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_tax_rate" double precision;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "snapshot_is_taxable" boolean;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "snapshot_tax_rate" double precision;