-- ---------------------------------------------------------------------------
-- Backfill DT22: business-date columns stored at 00:00 (midnight ghost).
-- Result: the UTC calendar day from the stored value (the form day as
-- persisted by z.iso.date) + the wall-clock time-of-day from the row's
-- created_at, interpreted in America/Caracas. Matches new writes via
-- composeBusinessTimestamp().
-- Timezone-safe: UTC anchoring is explicit, never the session TimeZone.
-- Idempotent: only touches rows still at midnight UTC.
-- ---------------------------------------------------------------------------
UPDATE "sale_payments" SET "payment_date" = (
	date_trunc('day', "payment_date" AT TIME ZONE 'UTC')
		+ (("created_at" AT TIME ZONE 'America/Caracas')
			- date_trunc('day', "created_at" AT TIME ZONE 'America/Caracas'))
) AT TIME ZONE 'America/Caracas'
WHERE "payment_date" = date_trunc('day', "payment_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "purchase_orders" SET "order_date" = (
	date_trunc('day', "order_date" AT TIME ZONE 'UTC')
		+ (("created_at" AT TIME ZONE 'America/Caracas')
			- date_trunc('day', "created_at" AT TIME ZONE 'America/Caracas'))
) AT TIME ZONE 'America/Caracas'
WHERE "order_date" = date_trunc('day', "order_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "purchase_order_payments" SET "payment_date" = (
	date_trunc('day', "payment_date" AT TIME ZONE 'UTC')
		+ (("created_at" AT TIME ZONE 'America/Caracas')
			- date_trunc('day', "created_at" AT TIME ZONE 'America/Caracas'))
) AT TIME ZONE 'America/Caracas'
WHERE "payment_date" = date_trunc('day', "payment_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "quotes" SET "quote_date" = (
	date_trunc('day', "quote_date" AT TIME ZONE 'UTC')
		+ (("created_at" AT TIME ZONE 'America/Caracas')
			- date_trunc('day', "created_at" AT TIME ZONE 'America/Caracas'))
) AT TIME ZONE 'America/Caracas'
WHERE "quote_date" = date_trunc('day', "quote_date" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
	AND "created_at" IS NOT NULL;
