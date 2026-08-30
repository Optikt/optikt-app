-- ---------------------------------------------------------------------------
-- Backfill: recompute sales.subtotal and quotes.subtotal as taxable base + exempt
-- (pre-tax, post per-line discount, pre global discount).
-- Per line: gross = unit_price * quantity
--           lineDiscount = discount_type='PERCENTAGE' ? gross * discount/100 : discount
--           line = greatest(0, gross - lineDiscount)
--           snapshot_is_taxable = true AND snapshot_tax_rate > 0
--             -> line / (1 + snapshot_tax_rate/100)   (base imponible)
--           else (incl. NULL snapshot_is_taxable) -> line   (exento)
-- Golden rule: total is NOT touched. Idempotent: pure function of persisted items.
-- ---------------------------------------------------------------------------
UPDATE "sales" SET "subtotal" = t."new_subtotal"
FROM (
	SELECT si."sale_id" AS "id",
		SUM(
			CASE
				WHEN si."snapshot_is_taxable" = true AND s."snapshot_tax_rate" > 0
					THEN GREATEST(0, si."unit_price" * si."quantity" - CASE WHEN si."discount_type" = 'PERCENTAGE' THEN si."unit_price" * si."quantity" * si."discount" / 100 ELSE si."discount" END) / (1 + s."snapshot_tax_rate" / 100)
				ELSE GREATEST(0, si."unit_price" * si."quantity" - CASE WHEN si."discount_type" = 'PERCENTAGE' THEN si."unit_price" * si."quantity" * si."discount" / 100 ELSE si."discount" END)
			END
		) AS "new_subtotal"
	FROM "sale_items" si
	JOIN "sales" s ON s."id" = si."sale_id"
	WHERE si."deleted_at" IS NULL
	GROUP BY si."sale_id"
) t
WHERE "sales"."id" = t."id";
--> statement-breakpoint
UPDATE "quotes" SET "subtotal" = t."new_subtotal"
FROM (
	SELECT qi."quote_id" AS "id",
		SUM(
			CASE
				WHEN qi."snapshot_is_taxable" = true AND q."snapshot_tax_rate" > 0
					THEN GREATEST(0, qi."unit_price" * qi."quantity" - CASE WHEN qi."discount_type" = 'PERCENTAGE' THEN qi."unit_price" * qi."quantity" * qi."discount" / 100 ELSE qi."discount" END) / (1 + q."snapshot_tax_rate" / 100)
				ELSE GREATEST(0, qi."unit_price" * qi."quantity" - CASE WHEN qi."discount_type" = 'PERCENTAGE' THEN qi."unit_price" * qi."quantity" * qi."discount" / 100 ELSE qi."discount" END)
			END
		) AS "new_subtotal"
	FROM "quote_items" qi
	JOIN "quotes" q ON q."id" = qi."quote_id"
	WHERE qi."deleted_at" IS NULL
	GROUP BY qi."quote_id"
) t
WHERE "quotes"."id" = t."id";
