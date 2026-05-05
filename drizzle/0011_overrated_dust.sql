CREATE TABLE "brand_suppliers" (
	"brand_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_suppliers_pkey" PRIMARY KEY("brand_id","supplier_id")
);
--> statement-breakpoint
ALTER TABLE "brand_suppliers" ADD CONSTRAINT "brand_suppliers_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_suppliers" ADD CONSTRAINT "brand_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_brand_suppliers_brand_id" ON "brand_suppliers" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "ix_brand_suppliers_supplier_id" ON "brand_suppliers" USING btree ("supplier_id" uuid_ops);--> statement-breakpoint
INSERT INTO "brand_suppliers" ("brand_id", "supplier_id")
SELECT DISTINCT "brand_id", "supplier_id"
FROM "products"
WHERE "brand_id" IS NOT NULL
	AND "deleted_at" IS NULL
ON CONFLICT ("brand_id", "supplier_id") DO NOTHING;