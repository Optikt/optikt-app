-- ---------------------------------------------------------------------------
-- created_at becomes the single date truth for sales (editable business date).
-- Backfill: created_at := date(sale_date) + time(created_at).
-- Normal sales keep their business day + real time. Historical backfills keep
-- the correct day with load time-of-day. Idempotent: pure function of both
-- columns. Assumes DB session TimeZone=UTC (see date-tz-normalize plan).
-- ---------------------------------------------------------------------------
UPDATE "sales" SET "created_at" = (("sale_date"::date + "created_at"::time))::timestamptz;--> statement-breakpoint
DROP INDEX "ix_sales_sale_date";--> statement-breakpoint
CREATE INDEX "ix_sales_created_at" ON "sales" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "sales" DROP COLUMN "sale_date";