CREATE TYPE "public"."purchase_discount_type" AS ENUM('NONE', 'PERCENT', 'AMOUNT');--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_discount_type" "purchase_discount_type" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_discount_value" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_discount_notes" varchar;