-- Add READY ("Lista para Retirar") to the sale_status enum.
-- NOTE: idempotent on purpose — mirrors the pattern used in 0034/0035/0037 for enum additions.
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		WHERE t.typname = 'sale_status' AND e.enumlabel = 'READY'
	) THEN
		ALTER TYPE "public"."sale_status" ADD VALUE 'READY';
	END IF;
END $$;
