ALTER TABLE "sale_items" ADD COLUMN "dp" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "np_right" double precision;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "np_left" double precision;--> statement-breakpoint
-- ---------------------------------------------------------------------------
-- Backfill de medidas de montaje (DP / naso-pupilar) desde la receta vinculada.
-- Solo filas con prescription_id (las demás quedan NULL → "—" en el panel, que
-- es el comportamiento aceptado para datos opcionales ausentes).
-- Idempotente de verdad: solo completa filas cuyas tres columnas siguen NULL
-- (nacen así en todas las filas existentes y protege ediciones posteriores).
-- ---------------------------------------------------------------------------
UPDATE "sale_items" si
SET "dp" = p."dp",
	"np_right" = p."np_right",
	"np_left" = p."np_left"
FROM "prescriptions" p
WHERE si."prescription_id" = p.id
	AND si."dp" IS NULL
	AND si."np_right" IS NULL
	AND si."np_left" IS NULL
	AND (p."dp" IS NOT NULL OR p."np_right" IS NOT NULL OR p."np_left" IS NOT NULL);