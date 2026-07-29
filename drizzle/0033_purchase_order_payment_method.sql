-- ============================================================================
-- PURCHASE ORDER PAYMENT METHOD
-- ============================================================================
-- Tracks the payment rail used for each supplier payment (Pago Móvil,
-- Transferencia, Punto de Venta, Efectivo, Binance, etc.), mirroring the
-- sales payment methods plus OTRO for exotic currencies (EUR, PayPal, or
-- any free-form channel). The method determines the persisted currencyCode.

--> statement-breakpoint

-- 1. New enum type for the payment rail
CREATE TYPE "public"."purchase_payment_method" AS ENUM (
  'PAGO_MOVIL_BS',
  'TRANSFERENCIA_BS',
  'PUNTO_VENTA_BS',
  'EFECTIVO_BS',
  'EFECTIVO_USD',
  'BINANCE_USDT',
  'OTRO'
);--> statement-breakpoint

-- 2. Add payment_method column (nullable during backfill)
ALTER TABLE "public"."purchase_order_payments" ADD COLUMN "payment_method" "public"."purchase_payment_method";--> statement-breakpoint

-- 3. Backfill from currency_code:
--    VES                  → TRANSFERENCIA_BS (most common Bs rail for supplier payments)
--    USD_BCV/USD_EFECTIVO → EFECTIVO_USD
--    USDT                 → BINANCE_USDT
--    anything else        → OTRO
UPDATE "public"."purchase_order_payments" SET "payment_method" = 'TRANSFERENCIA_BS' WHERE "currency_code" = 'VES';--> statement-breakpoint
UPDATE "public"."purchase_order_payments" SET "payment_method" = 'EFECTIVO_USD' WHERE "currency_code" IN ('USD_BCV', 'USD_EFECTIVO');--> statement-breakpoint
UPDATE "public"."purchase_order_payments" SET "payment_method" = 'BINANCE_USDT' WHERE "currency_code" = 'USDT';--> statement-breakpoint
UPDATE "public"."purchase_order_payments" SET "payment_method" = 'OTRO' WHERE "payment_method" IS NULL;--> statement-breakpoint

-- 4. Enforce NOT NULL + safe default for legacy insert paths
ALTER TABLE "public"."purchase_order_payments" ALTER COLUMN "payment_method" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."purchase_order_payments" ALTER COLUMN "payment_method" SET DEFAULT 'OTRO';