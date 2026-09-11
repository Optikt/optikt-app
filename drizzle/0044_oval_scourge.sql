-- ---------------------------------------------------------------------------
-- sales.snapshot_bcv_rate freezes the live USD BCV rate at submit time so
-- tickera receipts in Bs are deterministic on reprint. Backfill (honest
-- approximation): bcv_rate of the first non-voided payment per sale; NULL
-- when the sale has no payments (print falls back to the live rate).
-- Idempotent: only fills NULLs.
-- ---------------------------------------------------------------------------
ALTER TABLE "sales" ADD COLUMN "snapshot_bcv_rate" double precision;--> statement-breakpoint
UPDATE "sales" SET "snapshot_bcv_rate" = t."bcv_rate"
FROM (
	SELECT DISTINCT ON (sp."sale_id") sp."sale_id" AS "id", sp."bcv_rate"
	FROM "sale_payments" sp
	WHERE sp."voided_at" IS NULL AND sp."bcv_rate" > 0
	ORDER BY sp."sale_id", sp."created_at" ASC
) t
WHERE "sales"."id" = t."id" AND "sales"."snapshot_bcv_rate" IS NULL;