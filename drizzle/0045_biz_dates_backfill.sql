-- ---------------------------------------------------------------------------
-- Backfill DT22: business-date columns stored at 00:00 (midnight ghost).
-- Keeps the calendar day, takes wall-clock time-of-day from the row's
-- created_at (America/Caracas). Idempotent: only touches rows still at
-- midnight. New writes compose day + submit time via
-- composeBusinessTimestamp().
-- ---------------------------------------------------------------------------
UPDATE "sale_payments" SET "payment_date" =
	date_trunc('day', "payment_date") + make_interval(
		hrs => (EXTRACT(HOUR FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		mins => (EXTRACT(MINUTE FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		secs => FLOOR(EXTRACT(SECOND FROM "created_at" AT TIME ZONE 'America/Caracas'))::int
	)
WHERE date_trunc('day', "payment_date") = "payment_date"
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "purchase_orders" SET "order_date" =
	date_trunc('day', "order_date") + make_interval(
		hrs => (EXTRACT(HOUR FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		mins => (EXTRACT(MINUTE FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		secs => FLOOR(EXTRACT(SECOND FROM "created_at" AT TIME ZONE 'America/Caracas'))::int
	)
WHERE date_trunc('day', "order_date") = "order_date"
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "purchase_order_payments" SET "payment_date" =
	date_trunc('day', "payment_date") + make_interval(
		hrs => (EXTRACT(HOUR FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		mins => (EXTRACT(MINUTE FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		secs => FLOOR(EXTRACT(SECOND FROM "created_at" AT TIME ZONE 'America/Caracas'))::int
	)
WHERE date_trunc('day', "payment_date") = "payment_date"
	AND "created_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "quotes" SET "quote_date" =
	date_trunc('day', "quote_date") + make_interval(
		hrs => (EXTRACT(HOUR FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		mins => (EXTRACT(MINUTE FROM "created_at" AT TIME ZONE 'America/Caracas'))::int,
		secs => FLOOR(EXTRACT(SECOND FROM "created_at" AT TIME ZONE 'America/Caracas'))::int
	)
WHERE date_trunc('day', "quote_date") = "quote_date"
	AND "created_at" IS NOT NULL;
