-- ═══════════════════════════════════════════════════════════════════════════
-- quotes: Cashea flag + duplicate origin + sequence-backed quote_number
-- (plan quotes-redesign, decisiones D4 / D7 / D11)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── D11: sequence para quote_number (reemplaza MAX+1 no concurrente) ────────
-- La migración FALLA con mensaje claro si hay duplicados (no renumera a ciegas);
-- el índice único ya existía, el guard es defensa en profundidad.
DO $$
DECLARE
	dup_count int;
BEGIN
	SELECT count(*) INTO dup_count FROM (
		SELECT quote_number FROM quotes GROUP BY quote_number HAVING count(*) > 1
	) d;
	IF dup_count > 0 THEN
		RAISE EXCEPTION 'quotes: quote_number duplicado — corrige los datos antes de migrar';
	END IF;
END
$$;--> statement-breakpoint

CREATE SEQUENCE IF NOT EXISTS "quotes_quote_number_seq";--> statement-breakpoint

SELECT setval('quotes_quote_number_seq', COALESCE((SELECT MAX(quote_number) FROM quotes), 0) + 1, false);--> statement-breakpoint

ALTER TABLE "quotes" ALTER COLUMN "quote_number" SET DEFAULT nextval('quotes_quote_number_seq');--> statement-breakpoint

ALTER SEQUENCE "quotes_quote_number_seq" OWNED BY "quotes"."quote_number";--> statement-breakpoint

-- ── D4: Cashea en el presupuesto (se copia a la venta al convertir) ─────────
ALTER TABLE "quotes" ADD COLUMN "is_cashea" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- ── D7: origen del duplicado (historial: "Duplicado de P-XXXX") ─────────────
ALTER TABLE "quotes" ADD COLUMN "source_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_source_quote_id_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_quotes_source_quote_id" ON "quotes" USING btree ("source_quote_id" uuid_ops);
