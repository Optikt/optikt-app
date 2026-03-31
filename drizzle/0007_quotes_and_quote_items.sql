CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'APPROVED', 'CONVERTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"parent_quote_item_id" uuid,
	"supplier_treatment_id" uuid,
	"od_sphere" double precision,
	"od_cylinder" double precision,
	"od_axis" integer,
	"od_addition" double precision,
	"os_sphere" double precision,
	"os_cylinder" double precision,
	"os_axis" integer,
	"os_addition" double precision,
	"quantity" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"discount_type" varchar DEFAULT 'FIXED' NOT NULL,
	"snapshot_name" varchar,
	"snapshot_sku" varchar,
	"snapshot_brand" varchar,
	"snapshot_base_cost" double precision,
	"snapshot_mounting_price" double precision,
	"snapshot_shipping_price" double precision,
	"snapshot_sale_price" double precision,
	"snapshot_price_type" varchar,
	"snapshot_treatment_category" varchar,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_number" integer NOT NULL,
	"customer_id" uuid,
	"seller_id" uuid NOT NULL,
	"quote_date" timestamp NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"discount_type" varchar DEFAULT 'FIXED' NOT NULL,
	"total" double precision NOT NULL,
	"conversion_sale_id" uuid,
	"valid_until" timestamp,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_parent_quote_item_id_fkey" FOREIGN KEY ("parent_quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_supplier_treatment_id_fkey" FOREIGN KEY ("supplier_treatment_id") REFERENCES "public"."supplier_treatments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_conversion_sale_id_fkey" FOREIGN KEY ("conversion_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_quote_items_id" ON "quote_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_quote_id" ON "quote_items" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_product_id" ON "quote_items" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_lens_catalog_item_id" ON "quote_items" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_parent_id" ON "quote_items" USING btree ("parent_quote_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_customer_id" ON "quotes" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_id" ON "quotes" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_quote_date" ON "quotes" USING btree ("quote_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_seller_id" ON "quotes" USING btree ("seller_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_quotes_quote_number" ON "quotes" USING btree ("quote_number" int4_ops);