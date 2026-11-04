# quotes (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Presupuestos informativos (sin inventario): create/update (reemplazo de ítems), asignación de cliente, cancel, y conversión DRAFT→venta con snapshot BCV y prescripción derivada.

## Scope

`components/quotes/**`, `routes/(app)/quotes/**`, `remote/quotes/**`, `server/quotes/**`, `queries/quotes.ts`, `schemas/quotes*`, `schema/quotes.ts`; contratos `shared/contracts/quotes.ts`.

Owner rules: al convertir, el ítem se inserta con FIFO de `sales` (`insertSaleItem`) y el stock lo gobierna `inventory` — la quote **nunca** mueve stock por sí misma.

## Reglas de dominio / invarianzas

**Estados**

- Solo DRAFT es editable/cancelable/asignable/convertible (`remote/quotes/lifecycle.remote.ts:32-38,76-81`). Conversión marca `status=CONVERTED` + `conversionSaleId` (`server/quotes/convertQuoteToSale.ts:34-45,135-142`).
- Conversión exige cliente asignado e ítems > 0 (`convertQuoteToSale.ts:40-56`).

**Dinero**

- ⚠️ Los totales de la venta **siempre se recalculan**, jamás se copian de `quote.subtotal/total`: `convertQuoteToSale.ts:58-63` usa `computeSaleTotals` via `toSaleTotalsLine`; create usa `computeDocumentTotals` (`createNewQuote.ts:33`); `isTaxable` default = solo PRODUCT (`helpers.ts:38`) — misma semántica de subtotal del doc `sales`.
- Snapshot BCV congelado para tickera en la conversión; null si la API está caída (`convertQuoteToSale.ts:72-73,106`) — patrón idéntico a `sales`.
- `createdAt` de la venta nacente = now (día+hora, composición Caracas; `:97-99`) — pattern fecha-verdad del doc `sales`.

**Inventario y prescripción**

- La quote no toca stock; stock solo al convertir vía `insertSaleItem` FIFO (`convertQuoteToSale.ts:114-131`).
- Prescripción derivada de los ítems LENS_PAIR (primer valor definido por campo, `helpers.ts:82-137`); `unsetCurrent` antes de crear la nueva `isCurrent:true` (`convertQuoteToSale.ts:79-88`).
- ⚠️ Los campos `odAltura/osAltura` no se llenan en la derivación (`helpers.ts:126-127`) — el spec `docs/specs/quotes-altura.md` aún no existe.

**Escrituras**

- Todo el write en una tx: `getNextQuoteNumber` (MAX+1), cliente inline, quote e ítems (`createNewQuote.ts:43-78`); update borra+reinserta ítems con cascada de FREE details (`updateExistingQuote.ts:65-67`); validación de tratamientos y cliente fuera de la tx.
- Cada write tiene audit después de la tx (`createNewQuote.ts:81`).
- Ítems numerados/unificados por `insertQuoteItems` con tx del caller (`quoteItemInsert.ts:8`).

## Patrones locales

- Remote = shell (auth + delegation a `*Core` con `ActionContext`: `commands.remote.ts`, `lifecycle.remote.ts`) — mismo patrón DT9 que `sales`.
- Builders compartidos en `remote/quotes/helpers.ts` (`buildQuoteItemValues`, `resolveLensSnapshotCosts`) — ⚠️ server importa desde `$lib/remote/` (inversión de capas, deuda abajo).
- Estados/contratos en `$lib/shared/contracts/quotes`.

## Testing

- Int: `commands.int.spec.ts` (401), `lifecycle.int.spec.ts` (assign inline con birthDate+gender), `createNewQuote/updateExistingQuote/convertQuoteToSale.int.spec.ts`.
- Unit: `schemas/quotes.spec.ts`; E2E `e2e/quote-to-sale.test.ts`.

## Known gaps / tech debt

- 🟠 `getNextQuoteNumber` = MAX+1 — no a prueba de concurrencia; viola el unique index con `maxWorkers > 1` del harness de integración (`docs/specs/dt9-acceptance.md:111`) — los tests de este dominio no pueden correr en paralelo hasta migrar a secuencia.
- 🟡 ⚠️ Inversión de capas: `server/quotes/*` importa helpers desde `$lib/remote/quotes/` (`updateExistingQuote.ts:1`, `convertQuoteToSale.ts:1`, `quoteItemInsert.ts:3`) — mover a `server/quotes/` o `src/lib/shared/`, igual que el duplicado de `resolveLensSnapshotCosts` (doc `sales`).
- 🟡 `firstDefined` mezcla od/os de distintos LENS_PAIR sin prioridad explícita (`helpers.ts:89-97`).
- 🟡 `cancelQuote`/`assignQuoteCustomer` usan audit con `updated!` no-null assertion y sin tx compartida (`lifecycle.remote.ts:57,85`).
- 🟡 Spec `docs/specs/quotes-altura.md` pendiente de crear.
