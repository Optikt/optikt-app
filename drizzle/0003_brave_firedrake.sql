ALTER TABLE "sale_items" ADD COLUMN "snapshot_name" varchar;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_sku" varchar;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_brand" varchar;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_base_cost" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_mounting_price" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_shipping_price" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_sale_price" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_price_type" varchar;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "snapshot_treatment_category" varchar;