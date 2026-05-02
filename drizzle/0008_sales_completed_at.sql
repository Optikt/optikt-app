-- Add completed_at to sales for delivery-based P&L reporting.
-- A sale is recognized as "realized revenue" only when it is fully paid
-- and therefore delivered to the customer. completed_at marks that moment.
-- Idempotent: safe to re-run.

ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "completed_at" timestamp with time zone;
--> statement-breakpoint
-- Backfill: existing COMPLETED sales fall back to updated_at as a proxy.
-- (Per product owner, no historical COMPLETED sales exist in production yet.)
UPDATE "sales"
SET "completed_at" = "updated_at"
WHERE "status" = 'COMPLETED' AND "completed_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_sales_completed_at"
	ON "sales" USING btree ("completed_at" timestamptz_ops)
	WHERE "completed_at" IS NOT NULL;
