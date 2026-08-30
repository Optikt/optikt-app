CREATE TABLE "deleted_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" uuid NOT NULL,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_treatments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lens_technologies" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
--> statement-breakpoint
-- --------------------------------------------------------------------------
-- Backfill BEFORE dropping is_active: rows that were "inactive" are now
-- considered soft-deleted / deactivated. Without this they would reappear
-- because queries filter on deleted_at IS NULL / deactivated_at IS NULL.
-- --------------------------------------------------------------------------
UPDATE "supplier_treatments" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false;
UPDATE "lens_technologies" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false;
UPDATE "products" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false AND "deleted_at" IS NULL;
UPDATE "materials" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false AND "deleted_at" IS NULL;
UPDATE "lens_catalog_items" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false AND "deleted_at" IS NULL;
UPDATE "lens_materials" SET "deleted_at" = COALESCE("updated_at", now()) WHERE "is_active" = false AND "deleted_at" IS NULL;
UPDATE "users" SET "deactivated_at" = COALESCE("updated_at", now()) WHERE "is_active" = false AND "deactivated_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "supplier_treatments" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "materials" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "lens_catalog_items" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "lens_materials" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "lens_technologies" DROP COLUMN "is_active";--> statement-breakpoint
--> statement-breakpoint
ALTER TABLE "deleted_items" ADD CONSTRAINT "deleted_items_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ix_deleted_items_entity" ON "deleted_items" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ix_deleted_items_deleted_at" ON "deleted_items" USING btree ("entity_type","deleted_at");
