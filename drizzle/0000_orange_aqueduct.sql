CREATE TYPE "public"."treatment_category" AS ENUM('AR', 'BLUECUT');--> statement-breakpoint
CREATE TYPE "public"."lens_catalog_source" AS ENUM('FINISHED', 'LAB');--> statement-breakpoint
CREATE TYPE "public"."lens_inventory_mode" AS ENUM('ON_DEMAND', 'STOCK');--> statement-breakpoint
CREATE TYPE "public"."lens_price_type" AS ENUM('UNIT', 'PAIR');--> statement-breakpoint
CREATE TYPE "public"."sale_item_type" AS ENUM('PRODUCT', 'LENS_PAIR', 'TREATMENT');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'CONVERTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purchase_document_type" AS ENUM('INVOICE', 'DELIVERY_NOTE');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_item_type" AS ENUM('PRODUCT', 'LENS');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."inventory_movement_type" AS ENUM('PURCHASE_IN', 'SALE_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'CANCEL_REVERT');--> statement-breakpoint
CREATE TYPE "public"."movement_reference_type" AS ENUM('PURCHASE_ORDER', 'SALE', 'MANUAL_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar,
	"country" varchar,
	"logo_url" varchar,
	"website" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" varchar NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"changed_by_id" uuid,
	"changes" jsonb NOT NULL,
	"snapshot" jsonb,
	"reason" varchar,
	"ip_address" varchar(45),
	"user_agent" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar NOT NULL,
	"last_name" varchar NOT NULL,
	"id_number" varchar,
	"birth_date" timestamp with time zone,
	"primary_phone" varchar NOT NULL,
	"email" varchar,
	"address" varchar,
	"secondary_phones" json,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar NOT NULL,
	"name" varchar NOT NULL,
	"symbol" varchar DEFAULT '$' NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"currency_id" uuid NOT NULL,
	"rate_to_ves" double precision NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"source" varchar DEFAULT 'manual' NOT NULL,
	"notes" varchar,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar NOT NULL,
	"username" varchar NOT NULL,
	"full_name" varchar NOT NULL,
	"hashed_password" varchar NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_superuser" boolean DEFAULT false NOT NULL,
	"role" varchar DEFAULT 'VIEWER' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"category" "treatment_category" NOT NULL,
	"price" double precision NOT NULL,
	"sale_price" double precision,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_supplier_treatment_name" UNIQUE("supplier_id","name")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"rif" varchar,
	"primary_phone" varchar NOT NULL,
	"email" varchar,
	"address" varchar,
	"secondary_phones" json,
	"instagram" varchar,
	"whatsapp" varchar,
	"website" varchar,
	"contact_name" varchar,
	"contact_phone" varchar,
	"contact_role" varchar,
	"notes" varchar,
	"default_currency" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_name" varchar,
	"business_rif" varchar,
	"business_phone" varchar,
	"business_email" varchar,
	"business_address" varchar,
	"business_website" varchar,
	"business_logo" varchar,
	"default_tax_rate" double precision DEFAULT 16 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"description" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(255),
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"brand_id" uuid,
	"supplier_id" uuid NOT NULL,
	"color" varchar,
	"size" varchar,
	"gender" varchar(20),
	"material_id" uuid NOT NULL,
	"description" varchar,
	"current_purchase_price" double precision,
	"current_sale_price" double precision,
	"personal_code" varchar,
	"is_auto_sku" boolean DEFAULT false NOT NULL,
	"is_taxable" boolean DEFAULT true NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer,
	"image_url" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lens_catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "lens_catalog_source" DEFAULT 'LAB' NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"type" varchar NOT NULL,
	"technology" varchar,
	"material_id" uuid NOT NULL,
	"has_ar" boolean DEFAULT false NOT NULL,
	"has_bluecut" boolean DEFAULT false NOT NULL,
	"is_photochromic" boolean DEFAULT false NOT NULL,
	"price_type" "lens_price_type" DEFAULT 'UNIT' NOT NULL,
	"base_price" double precision NOT NULL,
	"pair_purchase_price" double precision DEFAULT 0 NOT NULL,
	"sale_price" double precision,
	"mounting_price" double precision DEFAULT 0 NOT NULL,
	"shipping_price" double precision DEFAULT 0 NOT NULL,
	"is_taxable" boolean DEFAULT false NOT NULL,
	"inventory_mode" "lens_inventory_mode" DEFAULT 'ON_DEMAND' NOT NULL,
	"stock" integer,
	"notes" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lens_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar NOT NULL,
	"refractive_index" double precision,
	"description" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lens_optical_ranges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lens_catalog_item_id" uuid NOT NULL,
	"sphere_min" double precision NOT NULL,
	"sphere_max" double precision NOT NULL,
	"cylinder_min" double precision,
	"cylinder_max" double precision,
	"addition_min" double precision,
	"addition_max" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"prescription_date" timestamp with time zone NOT NULL,
	"od_sphere" double precision,
	"od_cylinder" double precision,
	"od_axis" integer,
	"od_addition" double precision,
	"os_sphere" double precision,
	"os_cylinder" double precision,
	"os_axis" integer,
	"os_addition" double precision,
	"dp" double precision,
	"np_right" double precision,
	"np_left" double precision,
	"altura" double precision,
	"treatments" json,
	"recommended_lens_type" varchar,
	"notes" varchar,
	"doctor_name" varchar,
	"is_current" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"item_type" "sale_item_type" NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"parent_sale_item_id" uuid,
	"supplier_treatment_id" uuid,
	"lot_id" uuid,
	"prescription_id" uuid,
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
	"snapshot_cost_total" double precision,
	"snapshot_cost_unit" double precision,
	"snapshot_lots_count" integer,
	"snapshot_base_cost" double precision,
	"snapshot_mounting_price" double precision,
	"snapshot_shipping_price" double precision,
	"snapshot_sale_price" double precision,
	"snapshot_price_type" varchar,
	"snapshot_treatment_category" varchar,
	"snapshot_is_taxable" boolean,
	"snapshot_tax_rate" double precision,
	"shipping_cost_pending" boolean DEFAULT false,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_method" varchar NOT NULL,
	"amount" double precision NOT NULL,
	"exchange_rate" double precision,
	"bcv_rate" double precision NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"amount_bcv_usd" double precision NOT NULL,
	"reference" varchar,
	"notes" varchar,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" integer NOT NULL,
	"customer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"sale_date" timestamp with time zone NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"discount_type" varchar DEFAULT 'FIXED' NOT NULL,
	"total" double precision NOT NULL,
	"paid_amount_bcv_usd" double precision DEFAULT 0 NOT NULL,
	"notes" varchar,
	"cancellation_reason" varchar(500),
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"refund_status" varchar(20),
	"refund_amount" double precision,
	"refund_notes" varchar(500),
	"refunded_at" timestamp with time zone,
	"refunded_by_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"snapshot_is_taxable" boolean,
	"snapshot_tax_rate" double precision,
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
	"quote_date" timestamp with time zone NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"discount_type" varchar DEFAULT 'FIXED' NOT NULL,
	"total" double precision NOT NULL,
	"conversion_sale_id" uuid,
	"valid_until" timestamp with time zone,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"item_type" "purchase_order_item_type" NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"quantity" integer NOT NULL,
	"unit_purchase_price" double precision NOT NULL,
	"unit_sale_price" double precision NOT NULL,
	"applies_iva" boolean DEFAULT true NOT NULL,
	"iva_rate" double precision DEFAULT 16 NOT NULL,
	"lot_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" integer NOT NULL,
	"supplier_id" uuid NOT NULL,
	"invoice_number" varchar,
	"delivery_note_number" varchar,
	"status" "purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"document_type" "purchase_document_type" DEFAULT 'INVOICE' NOT NULL,
	"order_date" timestamp with time zone NOT NULL,
	"bcv_rate" double precision NOT NULL,
	"notes" varchar,
	"created_by_id" uuid NOT NULL,
	"confirmed_by_id" uuid,
	"confirmed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_number" integer NOT NULL,
	"purchase_order_item_id" uuid NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"quantity_initial" integer NOT NULL,
	"quantity_available" integer NOT NULL,
	"unit_purchase_price" double precision NOT NULL,
	"unit_sale_price" double precision NOT NULL,
	"bcv_rate_at_purchase" double precision NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movement_type" "inventory_movement_type" NOT NULL,
	"lot_id" uuid NOT NULL,
	"item_type" varchar NOT NULL,
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"quantity_delta" integer NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"reference_type" "movement_reference_type" NOT NULL,
	"reference_id" uuid NOT NULL,
	"notes" varchar,
	"unit_cost_at_adjustment" double precision,
	"total_cost_at_adjustment" double precision,
	"adjustment_report_category" varchar,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_treatments" ADD CONSTRAINT "supplier_treatments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."lens_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_optical_ranges" ADD CONSTRAINT "lens_optical_ranges_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "public"."prescriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_parent_sale_item_id_fkey" FOREIGN KEY ("parent_sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_supplier_treatment_id_fkey" FOREIGN KEY ("supplier_treatment_id") REFERENCES "public"."supplier_treatments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_refunded_by_id_fkey" FOREIGN KEY ("refunded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_parent_quote_item_id_fkey" FOREIGN KEY ("parent_quote_item_id") REFERENCES "public"."quote_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_supplier_treatment_id_fkey" FOREIGN KEY ("supplier_treatment_id") REFERENCES "public"."supplier_treatments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_conversion_sale_id_fkey" FOREIGN KEY ("conversion_sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_po_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "public"."purchase_order_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_brands_id" ON "brands" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_brands_name" ON "brands" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "ix_change_history_entity" ON "change_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_change_history_changed_at" ON "change_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "ix_change_history_changed_by" ON "change_history" USING btree ("changed_by_id");--> statement-breakpoint
CREATE INDEX "ix_change_history_action" ON "change_history" USING btree ("action");--> statement-breakpoint
CREATE INDEX "ix_customers_id" ON "customers" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_customers_id_number" ON "customers" USING btree ("id_number" text_ops);--> statement-breakpoint
CREATE INDEX "ix_customers_primary_phone" ON "customers" USING btree ("primary_phone" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_currencies_code" ON "currencies" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "ix_currencies_id" ON "currencies" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_exchange_rates_id" ON "exchange_rates" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_exchange_rates_currency_id" ON "exchange_rates" USING btree ("currency_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_exchange_rates_effective_date" ON "exchange_rates" USING btree ("effective_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_exchange_rates_currency_date" ON "exchange_rates" USING btree ("currency_id" uuid_ops,"effective_date" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ix_users_id" ON "users" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_users_username" ON "users" USING btree ("username" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_username_lower" ON "users" USING btree (lower((username)::text));--> statement-breakpoint
CREATE INDEX "ix_supplier_treatments_id" ON "supplier_treatments" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_supplier_treatments_supplier_id" ON "supplier_treatments" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_suppliers_id" ON "suppliers" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_suppliers_name" ON "suppliers" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_suppliers_rif" ON "suppliers" USING btree ("rif" text_ops);--> statement-breakpoint
CREATE INDEX "ix_materials_id" ON "materials" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_materials_product_type" ON "materials" USING btree ("product_type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_materials_name_product_type" ON "materials" USING btree ("name" text_ops,"product_type" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_materials_code" ON "materials" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "ix_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ix_user_sessions_id" ON "user_sessions" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_user_sessions_token_hash" ON "user_sessions" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE INDEX "ix_user_sessions_user_id" ON "user_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_products_brand_id" ON "products" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_products_id" ON "products" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_products_name" ON "products" USING btree ("name" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_products_sku" ON "products" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "ix_products_supplier_id" ON "products" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_products_type" ON "products" USING btree ("type" text_ops);--> statement-breakpoint
CREATE INDEX "ix_products_material_id" ON "products" USING btree ("material_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_id" ON "lens_catalog_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_material_id" ON "lens_catalog_items" USING btree ("material_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_catalog_items_supplier_id" ON "lens_catalog_items" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_lens_materials_code" ON "lens_materials" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_materials_id" ON "lens_materials" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_lens_materials_name" ON "lens_materials" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_optical_ranges_id" ON "lens_optical_ranges" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_optical_ranges_item_id" ON "lens_optical_ranges" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_customer_id" ON "prescriptions" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_id" ON "prescriptions" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_prescription_date" ON "prescriptions" USING btree ("prescription_date");--> statement-breakpoint
CREATE INDEX "ix_sale_items_id" ON "sale_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_lens_catalog_item_id" ON "sale_items" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_prescription_id" ON "sale_items" USING btree ("prescription_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_product_id" ON "sale_items" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_sale_id" ON "sale_items" USING btree ("sale_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_parent_id" ON "sale_items" USING btree ("parent_sale_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_lot_id" ON "sale_items" USING btree ("lot_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_payments_id" ON "sale_payments" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_payments_sale_id" ON "sale_payments" USING btree ("sale_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_customer_id" ON "sales" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_id" ON "sales" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_sale_date" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX "ix_sales_seller_id" ON "sales" USING btree ("seller_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_sales_order_number" ON "sales" USING btree ("order_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_id" ON "quote_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_quote_id" ON "quote_items" USING btree ("quote_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_product_id" ON "quote_items" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_lens_catalog_item_id" ON "quote_items" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quote_items_parent_id" ON "quote_items" USING btree ("parent_quote_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_customer_id" ON "quotes" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_id" ON "quotes" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_quotes_quote_date" ON "quotes" USING btree ("quote_date");--> statement-breakpoint
CREATE INDEX "ix_quotes_seller_id" ON "quotes" USING btree ("seller_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_quotes_quote_number" ON "quotes" USING btree ("quote_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_items_id" ON "purchase_order_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_items_po_id" ON "purchase_order_items" USING btree ("purchase_order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_items_product_id" ON "purchase_order_items" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_order_items_lens_id" ON "purchase_order_items" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_orders_id" ON "purchase_orders" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_purchase_orders_order_number" ON "purchase_orders" USING btree ("order_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_orders_supplier_id" ON "purchase_orders" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_orders_order_date" ON "purchase_orders" USING btree ("order_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "ix_purchase_orders_status" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_id" ON "inventory_lots" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_inventory_lots_lot_number" ON "inventory_lots" USING btree ("lot_number" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_product_id" ON "inventory_lots" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_lens_id" ON "inventory_lots" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_po_item_id" ON "inventory_lots" USING btree ("purchase_order_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_active_product" ON "inventory_lots" USING btree ("product_id" uuid_ops,"is_active");--> statement-breakpoint
CREATE INDEX "ix_inventory_lots_active_lens" ON "inventory_lots" USING btree ("lens_catalog_item_id" uuid_ops,"is_active");--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_id" ON "inventory_movements" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_lot_id" ON "inventory_movements" USING btree ("lot_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_product_id" ON "inventory_movements" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_lens_id" ON "inventory_movements" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_type" ON "inventory_movements" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_reference" ON "inventory_movements" USING btree ("reference_type","reference_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_inventory_movements_created_at" ON "inventory_movements" USING btree ("created_at" timestamptz_ops);