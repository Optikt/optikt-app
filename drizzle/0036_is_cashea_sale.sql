-- Add is_cashea flag to the sales table (buy-now-pay-later channel).
--> statement-breakpoint

ALTER TABLE "public"."sales" ADD COLUMN IF NOT EXISTS "is_cashea" boolean NOT NULL DEFAULT false;
