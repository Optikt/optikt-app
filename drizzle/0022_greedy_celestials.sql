ALTER TABLE "purchase_order_items" ADD COLUMN "line_number" integer;--> statement-breakpoint
WITH ranked_items AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "purchase_order_id"
			ORDER BY "created_at" ASC, "id" ASC
		) AS "line_number"
	FROM "purchase_order_items"
)
UPDATE "purchase_order_items" AS poi
SET "line_number" = ranked_items."line_number"
FROM ranked_items
WHERE poi."id" = ranked_items."id";--> statement-breakpoint
ALTER TABLE "purchase_order_items" ALTER COLUMN "line_number" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_purchase_order_items_po_line_number" ON "purchase_order_items" USING btree ("purchase_order_id" uuid_ops,"line_number" int4_ops);