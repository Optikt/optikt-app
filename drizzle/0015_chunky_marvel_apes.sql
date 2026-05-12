CREATE TABLE "brand_accessories" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid,
	"accessory_product_id" uuid,
	"default_price" double precision DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_accessories" ADD CONSTRAINT "brand_accessories_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_accessories" ADD CONSTRAINT "brand_accessories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_accessories" ADD CONSTRAINT "brand_accessories_accessory_product_id_fkey" FOREIGN KEY ("accessory_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_accessories" ADD CONSTRAINT "brand_accessories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_brand_accessories_id" ON "brand_accessories" USING btree ("id" int4_ops);--> statement-breakpoint
CREATE INDEX "ix_brand_accessories_brand_id" ON "brand_accessories" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_brand_accessories_product_id" ON "brand_accessories" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_brand_accessories_accessory_product_id" ON "brand_accessories" USING btree ("accessory_product_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_brand_accessories_brand_level" ON "brand_accessories" USING btree ("brand_id" uuid_ops,"accessory_product_id" uuid_ops) WHERE "brand_accessories"."product_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_brand_accessories_product_override" ON "brand_accessories" USING btree ("brand_id" uuid_ops,"product_id" uuid_ops,"accessory_product_id" uuid_ops) WHERE "brand_accessories"."product_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_brand_accessories_product_disabled_override" ON "brand_accessories" USING btree ("brand_id" uuid_ops,"product_id" uuid_ops) WHERE "brand_accessories"."product_id" IS NOT NULL AND "brand_accessories"."accessory_product_id" IS NULL;