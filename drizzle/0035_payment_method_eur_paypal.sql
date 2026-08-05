-- Add EFECTIVO_EUR and PAYPAL to the shared payment_method enum.
-- Add rate_type (labels the specificRate semantics) to both payment tables.
-- Add is_cashea_payment flag to sale_payments.
-- NOTE: idempotent on purpose — this migration was partially applied on some
-- environments (enum values committed, columns not). DO-block guards make the
-- retry safe; ADD COLUMN IF NOT EXISTS is natively supported.
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		WHERE t.typname = 'payment_method' AND e.enumlabel = 'EFECTIVO_EUR'
	) THEN
		ALTER TYPE "public"."payment_method" ADD VALUE 'EFECTIVO_EUR';
	END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_enum e
		JOIN pg_type t ON t.oid = e.enumtypid
		WHERE t.typname = 'payment_method' AND e.enumlabel = 'PAYPAL'
	) THEN
		ALTER TYPE "public"."payment_method" ADD VALUE 'PAYPAL';
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "public"."sale_payments" ADD COLUMN IF NOT EXISTS "rate_type" varchar(20);--> statement-breakpoint

ALTER TABLE "public"."purchase_order_payments" ADD COLUMN IF NOT EXISTS "rate_type" varchar(20);--> statement-breakpoint

ALTER TABLE "public"."sale_payments" ADD COLUMN IF NOT EXISTS "is_cashea_payment" boolean NOT NULL DEFAULT false;
