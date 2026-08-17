---
plan name: quotes-altura
plan description: Add per-eye altura to quote items
plan status: active
---

## Idea

`DT15` de PLAN.md: el feature ALTURA (2026-08) se agregó a `sale_items` y `prescriptions` pero `quote_items` quedó sin columnas. El wizard de presupuesto **reusa los componentes de venta** (`SaleStep2Items`, `SaleFormulaSlideOver` — los inputs ALT ya existen y capturan el dato), pero el dato se pierde: `QuoteItemSchema` no lo acepta, `buildQuoteItemsFromWizard` no lo mapea y el insert en `quotes.remote.ts` no lo persiste. `quote_items` guarda sphere/cylinder/axis/addition por ojo pero no la altura.

Nota: el detalle de presupuesto no renderiza la Rx (confirmado — no hay muestra de sphere/addition tampoco), así que **no hay UI de display que tocar**; el scope es schema + persistencia.

## Implementation

1. **Schema** `src/lib/server/db/schema/quotes.ts` — quote_items, después de `odAddition`/`osAddition` (líneas 122/126):
   - `odAltura: doublePrecision('od_altura')`
   - `osAltura: doublePrecision('os_altura')`

2. **Migración 0040** — patrón idempotente (mismo que 0039):
   - `drizzle/0040_quotes_altura.sql`: `ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS od_altura double precision, ... os_altura ...`
   - `drizzle/meta/_journal.json`: entrada 0040 con `when` monotónico; snapshot `drizzle/meta/0040_snapshot.json` (generar con `pnpm db:generate` de ser posible, o editar a mano siguiendo el patrón existente — snapshots de 0031-38 no existen, verificar formato del 0039)

3. **Zod** `src/lib/schemas/quotes.ts` — `QuoteItemSchema`:
   - `odAltura: AlturaSchema.optional()` y `osAltura: AlturaSchema.optional()` (tras `osAddition`)
   - Import `AlturaSchema` desde `$lib/schemas/prescriptions` (ya se usa así en `schemas/sales.ts`)

4. **Builder** `src/lib/components/sales/wizardSubmission.ts` — rama lens de `buildQuoteItemsFromWizard` (tras ~línea 210):
   - `odAltura: item.lensPair.od.enabled ? (item.lensPair.od.altura ?? undefined) : undefined`
   - `osAltura: item.lensPair.oi.enabled ? (item.lensPair.oi.altura ?? undefined) : undefined`
   - (mirror del `buildSaleItemsFromWizard` líneas 123/136)

5. **Persist** `src/lib/remote/quotes.remote.ts` — mapping del insert (~línea 88-92), tras `odAddition`/`osAddition`:
   - `odAltura: item.odAltura ?? null`
   - `osAltura: item.osAltura ?? null`
   - Revisar si hay path de edición de quote (línea ~721 es conversión quote→sale: verificar si también necesita mapear altura al crear la venta desde presupuesto)

6. **Tests** — spec de `QuoteItemSchema`: acepta odAltura/osAltura 10-40, rechaza fuera de rango, opcional.

## Verificación

- `pnpm check` 0 errores, `pnpm lint` limpio, `pnpm test:unit`
- Manual: crear presupuesto con lente bifocal/progresivo + altura por ojo → guardar → verificar en DB (`SELECT od_altura, os_altura FROM quote_items`)
- Convertir presupuesto→venta → la venta conserva la altura

## Archivos

- `src/lib/server/db/schema/quotes.ts`, `drizzle/0040_*.sql`, `drizzle/meta/_journal.json`
- `src/lib/schemas/quotes.ts` (+ spec)
- `src/lib/components/sales/wizardSubmission.ts`
- `src/lib/remote/quotes.remote.ts`