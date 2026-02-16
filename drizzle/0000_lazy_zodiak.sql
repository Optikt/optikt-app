CREATE TYPE "public"."lens_catalog_source" AS ENUM('FINISHED', 'LAB');--> statement-breakpoint
CREATE TYPE "public"."lens_pricing_unit" AS ENUM('UNIT', 'PAIR');--> statement-breakpoint
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
	"birth_date" date,
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
	"effective_date" date NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar NOT NULL,
	"product_type" varchar(20) NOT NULL,
	"refractive_index" double precision,
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
	"purchase_price" double precision NOT NULL,
	"purchase_currency" varchar,
	"purchase_currency_rate" double precision,
	"purchase_usd_bcv_rate" double precision,
	"purchase_date" date,
	"normalized_cost_usd" double precision,
	"sale_price" double precision NOT NULL,
	"stock" integer,
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
	"brand" varchar,
	"technology" varchar,
	"type" varchar NOT NULL,
	"material_id" uuid NOT NULL,
	"base_features" json,
	"is_photochromic" boolean DEFAULT false NOT NULL,
	"is_blue_cut" boolean DEFAULT false NOT NULL,
	"is_ar" boolean DEFAULT false NOT NULL,
	"pricing_unit" "lens_pricing_unit" DEFAULT 'UNIT' NOT NULL,
	"base_price" double precision NOT NULL,
	"suggested_multiplier" double precision,
	"mounting_price" double precision,
	"delivery_days" integer,
	"stock" integer,
	"refractive_index" double precision,
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
	"mirror_group" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lens_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"code" varchar NOT NULL,
	"description" varchar,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_lens_treatments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"treatment_id" uuid NOT NULL,
	"price" double precision NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_supplier_treatment" UNIQUE("supplier_id","treatment_id")
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"prescription_date" date NOT NULL,
	"od_sphere" double precision,
	"od_cylinder" double precision,
	"od_axis" integer,
	"od_addition" double precision,
	"os_sphere" double precision,
	"os_cylinder" double precision,
	"os_axis" integer,
	"os_addition" double precision,
	"pd" double precision,
	"pd_right" double precision,
	"pd_left" double precision,
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
	"product_id" uuid,
	"lens_catalog_item_id" uuid,
	"selected_treatments" json,
	"quantity" integer NOT NULL,
	"unit_price" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"sale_date" timestamp NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"total" double precision NOT NULL,
	"payment_method" varchar NOT NULL,
	"notes" varchar,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_history" ADD CONSTRAINT "change_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."lens_materials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD CONSTRAINT "lens_catalog_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lens_optical_ranges" ADD CONSTRAINT "lens_optical_ranges_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_lens_treatments" ADD CONSTRAINT "supplier_lens_treatments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_lens_treatments" ADD CONSTRAINT "supplier_lens_treatments_treatment_id_fkey" FOREIGN KEY ("treatment_id") REFERENCES "public"."lens_treatments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_lens_catalog_item_id_fkey" FOREIGN KEY ("lens_catalog_item_id") REFERENCES "public"."lens_catalog_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "ix_exchange_rates_effective_date" ON "exchange_rates" USING btree ("effective_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_exchange_rates_currency_date" ON "exchange_rates" USING btree ("currency_id" uuid_ops,"effective_date" date_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "ix_users_id" ON "users" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_users_username" ON "users" USING btree ("username" text_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_users_username_lower" ON "users" USING btree (lower((username)::text));--> statement-breakpoint
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
CREATE UNIQUE INDEX "ix_lens_treatments_code" ON "lens_treatments" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "ix_lens_treatments_id" ON "lens_treatments" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ix_lens_treatments_name" ON "lens_treatments" USING btree ("name" text_ops);--> statement-breakpoint
CREATE INDEX "ix_supplier_lens_treatments_id" ON "supplier_lens_treatments" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_supplier_lens_treatments_supplier_id" ON "supplier_lens_treatments" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_supplier_lens_treatments_treatment_id" ON "supplier_lens_treatments" USING btree ("treatment_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_customer_id" ON "prescriptions" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_id" ON "prescriptions" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_prescriptions_prescription_date" ON "prescriptions" USING btree ("prescription_date" date_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_id" ON "sale_items" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_lens_catalog_item_id" ON "sale_items" USING btree ("lens_catalog_item_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_product_id" ON "sale_items" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sale_items_sale_id" ON "sale_items" USING btree ("sale_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_customer_id" ON "sales" USING btree ("customer_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_id" ON "sales" USING btree ("id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_sale_date" ON "sales" USING btree ("sale_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "ix_sales_seller_id" ON "sales" USING btree ("seller_id" uuid_ops);