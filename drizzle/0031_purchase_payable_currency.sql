-- ============================================================================
-- MULTICURRENCY SETTLEMENT & NATIVE DEBT
-- ============================================================================

-- 1. Rename alt_rate → source_rate_to_ves (preserve values, no drop+add)
ALTER TABLE "purchase_orders" RENAME COLUMN "alt_rate" TO "source_rate_to_ves";

-- 2. purchase_orders — settlement obligation columns
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_currency" "purchase_payment_currency" NOT NULL DEFAULT 'USD_BCV';
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_rate_to_ves" double precision;
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_gross_amount" double precision NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_debt_amount" double precision NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN "settlement_debt_amount_usd_bcv_at_order" double precision NOT NULL DEFAULT 0;

-- 3. purchase_order_payments — native debt application columns
ALTER TABLE "purchase_order_payments" ADD COLUMN "amount_applied_to_debt" double precision NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_payments" ADD COLUMN "amount_applied_to_debt_usd_bcv_at_order" double precision NOT NULL DEFAULT 0;

-- 4. purchase_order_early_payment_benefits — native debt application columns
ALTER TABLE "purchase_order_early_payment_benefits" ADD COLUMN "amount_applied_to_debt" double precision NOT NULL DEFAULT 0;
ALTER TABLE "purchase_order_early_payment_benefits" ADD COLUMN "amount_applied_to_debt_usd_bcv_at_order" double precision NOT NULL DEFAULT 0;

-- 5. Backfill existing orders: settlement = legacy USD_BCV obligation
--    settlementDebtAmount = current computed debt (lines gross * discount factor)
--    settlementDebtAmountUsdBcvAtOrder = same as debt (already in USD_BCV)
UPDATE "purchase_orders" SET
  "settlement_gross_amount" = (
    SELECT ROUND(COALESCE(SUM("unit_purchase_price" * "quantity"), 0)::numeric, 2)
    FROM "purchase_order_items"
    WHERE "purchase_order_items"."purchase_order_id" = "purchase_orders"."id"
  ),
  "settlement_debt_amount" = (
    SELECT ROUND(COALESCE(SUM("unit_purchase_price" * "quantity"), 0)::numeric, 2)
    FROM "purchase_order_items"
    WHERE "purchase_order_items"."purchase_order_id" = "purchase_orders"."id"
  ),
  "settlement_debt_amount_usd_bcv_at_order" = (
    SELECT ROUND(COALESCE(SUM("unit_purchase_price" * "quantity"), 0)::numeric, 2)
    FROM "purchase_order_items"
    WHERE "purchase_order_items"."purchase_order_id" = "purchase_orders"."id"
  );

-- 6. Backfill existing payments: amountAppliedToDebt mirrors amountUsdBcv (legacy)
UPDATE "purchase_order_payments" SET
  "amount_applied_to_debt" = "amount_usd_bcv",
  "amount_applied_to_debt_usd_bcv_at_order" = "amount_usd_bcv";

-- 7. Backfill existing early-payment benefits: mirror amountUsdBcv (legacy)
UPDATE "purchase_order_early_payment_benefits" SET
  "amount_applied_to_debt" = "amount_usd_bcv",
  "amount_applied_to_debt_usd_bcv_at_order" = "amount_usd_bcv";
