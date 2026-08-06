-- Consolidate payment method enums into a single shared pgEnum.
-- sales: sale_payments.payment_method was varchar → now uses the shared enum.
-- purchases: purchase_order_payments.payment_method already used the enum;
--            the type is renamed in place (no data transformation).
--> statement-breakpoint

-- 1. Rename the purchase enum to a generic shared name
ALTER TYPE "public"."purchase_payment_method" RENAME TO "payment_method";--> statement-breakpoint

-- 2. Switch sale_payments.payment_method from varchar to the shared enum.
--    Existing values (PAGO_MOVIL_BS, TRANSFERENCIA_BS, PUNTO_VENTA_BS,
--    EFECTIVO_BS, EFECTIVO_USD, BINANCE_USDT) are a subset of the enum.
ALTER TABLE "public"."sale_payments" ALTER COLUMN "payment_method" TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint

-- NOTE: This migration is not reversible with data in place (renaming the enum
-- back would require recreating both column types and casts).
