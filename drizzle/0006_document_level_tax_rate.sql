ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "snapshot_tax_rate" double precision;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "snapshot_tax_rate" double precision;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "sale_items"
		WHERE "deleted_at" IS NULL
			AND "snapshot_tax_rate" IS NOT NULL
			AND "snapshot_tax_rate" > 0
		GROUP BY "sale_id"
		HAVING COUNT(DISTINCT "snapshot_tax_rate") > 1
	) THEN
		RAISE EXCEPTION 'Cannot migrate sales.snapshot_tax_rate: found sales with multiple positive item tax rates';
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "quote_items"
		WHERE "deleted_at" IS NULL
			AND "snapshot_tax_rate" IS NOT NULL
			AND "snapshot_tax_rate" > 0
		GROUP BY "quote_id"
		HAVING COUNT(DISTINCT "snapshot_tax_rate") > 1
	) THEN
		RAISE EXCEPTION 'Cannot migrate quotes.snapshot_tax_rate: found quotes with multiple positive item tax rates';
	END IF;
END
$$;
--> statement-breakpoint
WITH settings_default AS (
	SELECT COALESCE(
		(
			SELECT "default_tax_rate"
			FROM "settings"
			ORDER BY "created_at" ASC NULLS LAST
			LIMIT 1
		),
		16::double precision
	) AS "rate"
),
sale_rates AS (
	SELECT
		"sales"."id" AS "sale_id",
		COALESCE(
			MAX("sale_items"."snapshot_tax_rate") FILTER (WHERE "sale_items"."snapshot_tax_rate" > 0),
			MAX("sale_items"."snapshot_tax_rate"),
			(SELECT "rate" FROM settings_default)
		) AS "snapshot_tax_rate"
	FROM "sales"
	LEFT JOIN "sale_items"
		ON "sale_items"."sale_id" = "sales"."id"
		AND "sale_items"."deleted_at" IS NULL
	GROUP BY "sales"."id"
)
UPDATE "sales"
SET "snapshot_tax_rate" = sale_rates."snapshot_tax_rate"
FROM sale_rates
WHERE "sales"."id" = sale_rates."sale_id";
--> statement-breakpoint
WITH settings_default AS (
	SELECT COALESCE(
		(
			SELECT "default_tax_rate"
			FROM "settings"
			ORDER BY "created_at" ASC NULLS LAST
			LIMIT 1
		),
		16::double precision
	) AS "rate"
),
quote_rates AS (
	SELECT
		"quotes"."id" AS "quote_id",
		COALESCE(
			MAX("quote_items"."snapshot_tax_rate") FILTER (WHERE "quote_items"."snapshot_tax_rate" > 0),
			MAX("quote_items"."snapshot_tax_rate"),
			(SELECT "rate" FROM settings_default)
		) AS "snapshot_tax_rate"
	FROM "quotes"
	LEFT JOIN "quote_items"
		ON "quote_items"."quote_id" = "quotes"."id"
		AND "quote_items"."deleted_at" IS NULL
	GROUP BY "quotes"."id"
)
UPDATE "quotes"
SET "snapshot_tax_rate" = quote_rates."snapshot_tax_rate"
FROM quote_rates
WHERE "quotes"."id" = quote_rates."quote_id";
--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "snapshot_tax_rate" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "snapshot_tax_rate" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "sale_items" DROP COLUMN IF EXISTS "snapshot_tax_rate";
--> statement-breakpoint
ALTER TABLE "quote_items" DROP COLUMN IF EXISTS "snapshot_tax_rate";