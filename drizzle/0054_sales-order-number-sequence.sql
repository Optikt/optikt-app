-- ═══════════════════════════════════════════════════════════════════════════
-- sales: sequence-backed order_number (reemplaza MAX+1 no concurrente)
-- Mismo patrón que quotes (0053). El número manual del ADMIN (salto/backfill)
-- sigue permitido: la app sube la sequence con setval solo hacia arriba
-- (queries/sales/writes.ts → bumpSaleOrderSequence).
-- Rollback: ALTER TABLE "sales" ALTER COLUMN "order_number" DROP DEFAULT;
--           DROP SEQUENCE "sales_order_number_seq";  (y volver a MAX+1 en código)
-- ═══════════════════════════════════════════════════════════════════════════

-- La migración FALLA con mensaje claro si hay duplicados (no renumera a ciegas);
-- el índice único ix_sales_order_number ya existe, el guard es defensa en profundidad.
DO $$
DECLARE
	dup_count int;
BEGIN
	SELECT count(*) INTO dup_count FROM (
		SELECT order_number FROM sales GROUP BY order_number HAVING count(*) > 1
	) d;
	IF dup_count > 0 THEN
		RAISE EXCEPTION 'sales: order_number duplicado — corrige los datos antes de migrar';
	END IF;
END
$$;--> statement-breakpoint

CREATE SEQUENCE IF NOT EXISTS "sales_order_number_seq";--> statement-breakpoint

-- Próximo número = MAX(order_number) + 1 (incluye ventas soft-deleted: el unique es global)
SELECT setval('sales_order_number_seq', COALESCE((SELECT MAX(order_number) FROM sales), 0) + 1, false);--> statement-breakpoint

ALTER TABLE "sales" ALTER COLUMN "order_number" SET DEFAULT nextval('sales_order_number_seq');--> statement-breakpoint

ALTER SEQUENCE "sales_order_number_seq" OWNED BY "sales"."order_number";
