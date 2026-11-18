# quotes (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Presupuestos informativos (sin inventario): create/update (reemplazo de ítems), cancel, y conversión DRAFT→venta con snapshot BCV y prescripción derivada. Lógica en `src/lib/server/quotes/*Core` (patrón shell/core DT9); remotes son shells de auth + delegación. El detalle y el listado comparten el lenguaje visual de ventas (componentes generalizados), ver patrones abajo.

## Scope

`components/quotes/**`, `routes/(app)/quotes/**`, `remote/quotes/**`, `server/quotes/**`, `queries/quotes.ts`, `schemas/quotes*`, `schema/quotes.ts`; contratos `shared/contracts/quotes.ts`; lógica pura `shared/quotes/*`.

Owner rules: al convertir, el ítem se inserta con FIFO de `sales` (`insertSaleItem`) y el stock lo gobierna `inventory` — la quote **nunca** mueve stock por sí misma. La conversión usa exactamente la política de stock de crear una venta nueva hoy.

## Reglas de dominio / invarianzas

**Estados**

- Solo DRAFT es editable/cancelable/convertible (`remote/quotes/lifecycle.remote.ts`). Conversión marca `status=CONVERTED` + `conversionSaleId` mediante `markQuoteConverted` (`UPDATE ... WHERE status='DRAFT' RETURNING *`) — guard de concurrencia: dos conversiones simultáneas nunca crean dos ventas (0 filas ⇒ rollback de la tx completa).
- Conversión exige cliente: del presupuesto, `customerId` existente o `newCustomer` inline (D5). Sin cliente ⇒ error `Selecciona o registra al cliente para convertir`.
- **D3 (validez):** `validUntil = null` ⇒ el presupuesto **no vence**. "Vencido" se calcula al leer con `quoteValidity()` (`src/lib/shared/quotes/quoteValidity.ts`, zona Caracas, `soon` si quedan ≤3 días). **Nunca** se escribe `status = EXPIRED`; el valor del enum `QuoteStatus.EXPIRED` queda sin uso en la UI (se conserva en el enum/contrato por compatibilidad). No se muestra la pestaña "Expirado".

**Dinero**

- ⚠️ Los totales de la venta **siempre se recalculan**, jamás se copian de `quote.subtotal/total`: `convertQuoteToSale.ts` usa `computeSaleTotals` vía `toSaleTotalsLine` (de `$lib/shared/saleTotals`); create usa `computeDocumentTotals`; `isTaxable` default = solo PRODUCT — misma semántica de subtotal del doc `sales`.
- Snapshot BCV congelado para tickera en la conversión; null si la API está caída — patrón idéntico a `sales`. El presupuesto **no congela tasa**: los Bs. del detalle usan la tasa viva y se marcan como referenciales (≈).
- `createdAt` de la venta nacente = now (día+hora, composición Caracas) — patrón fecha-verdad del doc `sales`. El PDF del presupuesto **no muestra Cashea** (D4).

**Cashea (D4)**

- `quotes.is_cashea` se marca al crear (`CreateQuoteSchema.isCashea`), editar (`UpdateQuoteSchema.isCashea`) y duplicar. Al convertir se copia a la venta: `isCashea: data.isCashea ?? quote.isCashea` (override editable en el modal de conversión). El checkbox del modal viene marcado desde el presupuesto.
- Auditoría de conversión: `logCreate('sale')`, `logCreate('prescription')` si aplica, `logCreate('customer')` si se creó inline, y `logUpdate('quote', before/after)` con estado, `conversionSaleId` y `customerId`. El historial muestra "Convertido en venta #NNNN" y "Cashea activado".

**Inventario y prescripción**

- La quote no toca stock; stock solo al convertir vía `insertSaleItem` → `consumeFifoForSaleItem` (FIFO de lotes, movimientos `SALE_OUT`, caché de stock). Stock insuficiente lanza y revierte toda la tx — **misma política que venta nueva**, sin política nueva. El preview de conversión solo clasifica/avisa (`untracked` para ítems libres y lentes ON_DEMAND), nunca bloquea.
- **Precio presupuestado respetado (D8):** si el catálogo cambió de precio, el modal avisa `USD 280 → 295` pero la conversión usa `unitPrice` del ítem. No existe botón "Actualizar precios": para usar el precio nuevo hay que editar el presupuesto.
- Prescripción derivada de los ítems LENS_PAIR (primer valor definido por campo, `firstDefined`), `unsetCurrent` antes de crear la nueva `isCurrent:true`. Altura OD/OS **sí se mapea** (`odAltura/osAltura`) desde `quote_items`. Ver deuda multi-persona abajo.

**Escrituras**

- Todo write en una sola tx; las query functions aceptan `executor: DbOrTx = db` y reciben `tx`. `resolveInlineCustomer` pasa el executor hasta `findCustomerByIdNumber` para que el chequeo de cédula duplicada vea la tx (rollback si duplicado). Audit siempre **después** de la tx (best-effort).
- Numeración por **sequence** de Postgres (migración 0053): `quotes_quote_number_seq` con `setval(MAX+1, false)`, `OWNED BY quotes.quote_number`, unique index ya existente en `quote_number` + guard de duplicados en la migración. `getNextQuoteNumber` (MAX+1) **eliminado**: `createQuote` deja que la DB asigne el número vía `.returning()`. El `getQuoteNumberPreview` (MAX+1) es solo informativo/etiquetado en código como "puede cambiar al guardar".

**Duplicar (D7)**

- Permitido desde cualquier estado (borrador, convertido, cancelado). Ruta `/quotes/new?from=<id>`; el loader delgado entrega `{quote, items}` al wizard. `quoteToWizardDraft()` (puro, con spec) copia ítems (fórmula por ojo **con altura**, tratamientos hijos), descuento, isCashea y notas; resetea cliente, fecha (hoy), validUntil (vacío) y número (preview nuevo). Guarda `sourceQuoteId` (FK self, ON DELETE SET NULL, índice). El historial y el detalle muestran "Duplicado de P-0231" (el loader resuelve el número del origen).

## Endpoints (remote)

- `listQuotes({page, perPage, status, sellerId, dateFrom, dateTo, search, isCashea?, sort})` → `{quotes,total,page,perPage,totalPages,selection}`. `sort`: `recent|total|expiring` ("vencen primero"). `getQuoteFacets()` → conteos por estado respetando los demás filtros. `getQuoteStats()` → KPIs globales: `open/openTotal` (DRAFT), `monthly/monthlyTotal` (creados desde inicio de mes por `quoteDate`), `monthlyConverted` (CONVERTIDOS cuya venta generada tiene `createdAt` ≥ inicio de mes); **tasa de conversión = monthlyConverted / monthly** (0 si monthly=0), redondeada al entero en la UI.
- `getQuoteConversionPreview(id)` → por ítem `{quoteItemId,label,stock:{kind:'ok'|'insufficient'|'untracked',available?,needed},price:{quoted,current,changed}}` y resumen `{allStockOk,priceChangedCount,missingCustomer}`. La **misma query** alimenta el bloque "Si se convierte hoy" del hero y la sección "Revisión" del modal. Clasificación pura en `server/quotes/conversionPreviewLogic.ts` con spec.
- `convertQuoteToSale({id, customerId?, newCustomer?, isCashea?})` → valida fuera de tx, crea cliente inline dentro, recompone la venta con `createSale(data, tx)`, ítems con `insertSaleItem(tx, …)`, guard de concurrencia y audit after-tx. El cliente asignado se escribe en la quote en la misma tx. Devuelve `{success:true, sale}` con `orderNumber` para el toast.
- `assignQuoteCustomer` **eliminado** (D5): el link "Asignar cliente ahora" del hero abre el modal de conversión en modo sin cliente; la conversión asigna el cliente y crea la venta en una sola tx. Su schema y su spec de remote también se eliminaron.
- `getQuoteNumberPreview()` (query) → número preview no reservante para el wizard.

## Patrones locales

- Remote = shell (auth + delegación a `*Core` con `ActionContext`), mismo patrón DT9 que `sales`.
- Helpers puros de quotes en `src/lib/server/quotes/quoteHelpers.ts` (buildQuoteItemValues, firstDefined, derivePrescriptionFromQuoteItems). `toSaleTotalsLine` y `resolveLensSnapshotCosts` viven en `$lib/shared/` (fuente única compartida con ventas; consolidaron los duplicados de `remote/{quotes,sales}/helpers`). **Ningún archivo de `server/` importa de `remote/`**.
- **Reuso de componentes de ventas (plan quotes-redesign):** hero navy con CSS compartido en `$lib/components/layout/heroNavy.css` (container queries `<700/≥700/≥1500` contra `.page`, nunca viewport; tope 1760px); `SaleDetailHeroCustomer` con `emptyState` opcional; `SaleItemsTable` en solo lectura vía `groups`/`headerBadge` opcionales y el adapter `quoteItemsAdapter.ts`; historial propio `QuoteAuditTimeline`/`QuoteAuditHistoryDrawer`. `SaleListHeader`, `SaleFilterBar`, `SaleStatusTabs`, `SaleFilterChips`, `SaleListFooter` se generalizaron con props opcionales (ventas sin cambios visuales). `QuoteDetailMobileBar` replica `SaleDetailMobileBar` (barra inferior + hoja "Más").
- **Editar (D1):** `EditSaleModal` parametrizado con `quote`/`quoteItems` + `quoteEditAdapter.ts`; sin motivo, sin reversión de stock, Cashea + Válido hasta en la meta bar, guarda con `updateExistingQuote`, toast "Presupuesto actualizado", solo DRAFT. El wizard usa `SaleStep1Info`/`SaleStep2Items`/`SaleStep3Summary` (el wrapper `QuoteStep3Summary` se borró).
- **Conversión (D2):** un único modal de revisión, no wizard. Cliente inline se resuelve con `CustomerLookupInput`, se envía como `newCustomer` (no se crea al tipear). `Crear venta` con `aria-disabled` + `TriggerTooltip` "Falta completar: Cliente" + línea inline en táctil; doble clic protegido. Éxito: toast con acción "Ver venta" y navegación a `/sales/<id>` (comportamiento previo de la app, documentado).

## Testing

- Unit: `schemas/quotes.spec.ts`, `shared/quotes/quoteValidity.spec.ts`, `server/quotes/conversionPreviewLogic.spec.ts`, `components/quotes/detail/{quoteAudit,quoteItemsAdapter}.spec.ts`, `components/quotes/duplicate/quoteToWizardDraft.spec.ts`, `components/quotes/editQuote` (adapter). Int: `server/quotes/{createNewQuote,updateExistingQuote,convertQuoteToSale}.int.spec.ts` (10 casos de conversión: cliente existente/inline/sin cliente, rollback por duplicado, override Cashea, doble conversión concurrente, no-DRAFT, stock insuficiente, altura), `remote/quotes/commands.int.spec.ts`. E2E `e2e/quote-to-sale.test.ts`.
- ⚠️ Los int specs requieren Docker/Testcontainers; en este entorno no hay Docker → se ejecutaron los unit (`pnpm test:unit`, verde) pero NO los int. La migración sí se aplicó a la DB de desarrollo para la verificación visual.

## Known gaps / tech debt

- 🟠 **Fórmulas multi-persona (sin resolver, documentado en `sales.md` también):** un presupuesto o venta puede llevar lentes de varias personas (madre e hija, pareja). Hoy la conversión deriva **una** prescripción con `firstDefined` sobre todos los LENS_PAIR y la marca `isCurrent` para el cliente titular — con varias personas guarda una fórmula equivocada y puede pisar la fórmula vigente del titular. A futuro: registrar a quién pertenece cada fórmula (persona por ítem LENS_PAIR, otro cliente o "beneficiario") y no sobreescribir la del titular. No hay card de fórmula única por documento; la fórmula se ve por ítem (fila del lente).
- 🟡 Las quotes no registran medidas de montaje (DP/NP) en sus ítems; la conversión no copia medidas a la venta (mismo hueco de larga data). El preseed del editor de lente usa `null` para esas medidas.

## Deuda resuelta en este PR

- `getNextQuoteNumber` MAX+1 → sequence de Postgres + preview no reservante.
- Inversión de capas `server/quotes/* → $lib/remote/quotes/helpers` eliminada; `remote/quotes/helpers.ts` borrado.
- Drizzle inline en `convertQuoteToSale.ts` / `createNewQuote.ts` / `updateExistingQuote.ts` → query functions con executor.
- `odAltura/osAltura` mapeados en la prescripción derivada. El spec `docs/specs/quotes-altura.md` **no existe** (verificado); la cobertura está en `convertQuoteToSale.int.spec.ts`.
- Barrel `components/quotes/index.ts` borrado (importadores migrados a imports directos).
- `title`/`disabled` nativos en la lista → `TriggerTooltip` + `aria-disabled`.
- `assignQuoteCustomer` eliminado.

## Planes completados

- **2026-11 · quotes-altura** — Altura por ojo en presupuestos (DT15)
- **2026-11 · quotes-redesign** — Rediseño completo de Presupuestos: lista, detalle (hero/móvil/historial), drawer de edición y modal de conversión reutilizando componentes de ventas; backend con Cashea, sequence, guard de concurrencia, cliente inline en una tx y preview de conversión; duplicar desde cualquier estado con sourceQuoteId; docs y deuda multi-persona documentada. Verificación: /verify 3 PASS (125 archivos, 1356 tests), coverage 99.9%, screenshots 390/1280/2560, subagentes PASS con hallazgos corregidos. PR #229. (#229)
