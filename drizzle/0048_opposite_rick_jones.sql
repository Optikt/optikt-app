CREATE TABLE "inventory_count_responsibles" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" uuid,
	"display_name" varchar NOT NULL,
	"is_external" boolean DEFAULT false NOT NULL,
	"added_by_id" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "count_cycle_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "count_diff_threshold_units" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "count_diff_threshold_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "count_quick_oldest_limit" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_counted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "last_count_session_id" integer;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "last_counted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lens_catalog_items" ADD COLUMN "last_count_session_id" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "recounted_stock" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "recounted_by_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "recounted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "adjustment_movement_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "adjustment_reason" varchar;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "adjustment_reason_text" varchar;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "adjustment_requested_by" uuid;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "adjustment_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_count_lines" ADD COLUMN "fifo_cost_usd" double precision;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "scope_dim" varchar;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "scope_values" varchar[];--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "scope_n" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "scope_kind" varchar;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "coverage_before" double precision;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "coverage_never_before" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "coverage_after" double precision;--> statement-breakpoint
ALTER TABLE "inventory_count_sessions" ADD COLUMN "coverage_never_after" integer;--> statement-breakpoint
ALTER TABLE "inventory_count_responsibles" ADD CONSTRAINT "inventory_count_responsibles_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."inventory_count_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_count_responsibles" ADD CONSTRAINT "inventory_count_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inventory_count_responsibles_session" ON "inventory_count_responsibles" USING btree ("session_id" int4_ops,"removed_at");--> statement-breakpoint
CREATE INDEX "ix_inventory_count_responsibles_user" ON "inventory_count_responsibles" USING btree ("user_id" uuid_ops);
--> statement-breakpoint
-- Backfill: cobertura por ítem a partir de sesiones APPLIED existentes.
-- Un ítem queda verificado si fue contado (o confirmado en 0) en una sesión cerrada.
UPDATE "products" p SET "last_counted_at" = agg."max_at", "last_count_session_id" = agg."session_id"
FROM (
	SELECT l."product_id",
		MAX(l."counted_at") AS max_at,
		(array_agg(l."session_id" ORDER BY l."counted_at" DESC NULLS LAST))[1] AS "session_id"
	FROM "inventory_count_lines" l
	JOIN "inventory_count_sessions" s ON s."id" = l."session_id"
	WHERE s."status" = 'APPLIED' AND l."item_type" = 'PRODUCT'
		AND l."product_id" IS NOT NULL AND l."counted_stock" IS NOT NULL
	GROUP BY l."product_id"
) agg WHERE p."id" = agg."product_id";
--> statement-breakpoint
UPDATE "lens_catalog_items" i SET "last_counted_at" = agg."max_at", "last_count_session_id" = agg."session_id"
FROM (
	SELECT l."lens_catalog_item_id",
		MAX(l."counted_at") AS max_at,
		(array_agg(l."session_id" ORDER BY l."counted_at" DESC NULLS LAST))[1] AS "session_id"
	FROM "inventory_count_lines" l
	JOIN "inventory_count_sessions" s ON s."id" = l."session_id"
	WHERE s."status" = 'APPLIED' AND l."item_type" = 'LENS'
		AND l."lens_catalog_item_id" IS NOT NULL AND l."counted_stock" IS NOT NULL
	GROUP BY l."lens_catalog_item_id"
) agg WHERE i."id" = agg."lens_catalog_item_id";
--> statement-breakpoint
-- Backfill: responsables activos para sesiones OPEN existentes (la apertura queda registrada).
INSERT INTO "inventory_count_responsibles" ("session_id", "user_id", "display_name", "is_external", "added_by_id", "added_at")
SELECT s."id", s."opened_by_id", COALESCE(u."full_name", 'Usuario'), false, s."opened_by_id", s."opened_at"
FROM "inventory_count_sessions" s
JOIN "users" u ON u."id" = s."opened_by_id"
WHERE s."status" = 'OPEN'
	AND NOT EXISTS (
		SELECT 1 FROM "inventory_count_responsibles" r
		WHERE r."session_id" = s."id" AND r."user_id" = s."opened_by_id"
	);

--> statement-breakpoint
-- Backfill: congela el costo FIFO actual de las líneas con diferencia en
-- sesiones ya cerradas (mejor aproximación histórica disponible; a partir de
-- aquí el informe no se mueve con el stock vivo).
UPDATE "inventory_count_lines" l SET "fifo_cost_usd" = f.cost
FROM (
	SELECT l2."id",
		(SELECT lu."unit_purchase_price" FROM "inventory_lots" lu
		 WHERE lu."product_id" = l2."product_id" AND lu."is_active" AND lu."quantity_available" > 0
		 ORDER BY lu."created_at" ASC, lu."id" ASC LIMIT 1) AS cost
	FROM "inventory_count_lines" l2
	JOIN "inventory_count_sessions" s ON s."id" = l2."session_id"
	WHERE s."status" IN ('APPLIED', 'CANCELLED')
		AND l2."item_type" = 'PRODUCT' AND l2."product_id" IS NOT NULL
		AND (COALESCE(l2."recounted_stock", l2."counted_stock") - l2."system_stock") <> 0
) f
WHERE l."id" = f."id" AND f."cost" IS NOT NULL AND l."fifo_cost_usd" IS NULL;
--> statement-breakpoint
UPDATE "inventory_count_lines" l SET "fifo_cost_usd" = f.cost
FROM (
	SELECT l2."id",
		(SELECT lu."unit_purchase_price" FROM "inventory_lots" lu
		 WHERE lu."lens_catalog_item_id" = l2."lens_catalog_item_id" AND lu."is_active" AND lu."quantity_available" > 0
		 ORDER BY lu."created_at" ASC, lu."id" ASC LIMIT 1) AS cost
	FROM "inventory_count_lines" l2
	JOIN "inventory_count_sessions" s ON s."id" = l2."session_id"
	WHERE s."status" IN ('APPLIED', 'CANCELLED')
		AND l2."item_type" = 'LENS' AND l2."lens_catalog_item_id" IS NOT NULL
		AND (COALESCE(l2."recounted_stock", l2."counted_stock") - l2."system_stock") <> 0
) f
WHERE l."id" = f."id" AND f."cost" IS NOT NULL AND l."fifo_cost_usd" IS NULL;