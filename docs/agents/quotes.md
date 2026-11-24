# quotes (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Presupuestos informativos (sin inventario): create/update (reemplazo de ítems), cancel, y conversión DRAFT→venta con snapshot BCV y prescripción derivada. Lógica en `src/lib/server/quotes/*Core` (patrón shell/core DT9); remotes son shells de auth + delegación. El detalle y el listado comparten el lenguaje visual de ventas (componentes generalizados), ver patrones abajo.

## Scope

`components/quotes/**`, `routes/(app)/quotes/**`, `remote/quotes/**`, `server/quotes/**`, `queries/quotes/{types,shared,list,reads,writes,conversion}.ts`, `schemas/quotes*`, `schema/quotes.ts`; contratos `shared/contracts/quotes.ts`; lógica pura `shared/quotes/*` (incluye `conversionPreview.ts` y `convertedSale.ts`). Nota: `queries/quotes.ts` se partió en módulos (gate de tamaño); **no hay barrel**, se importa el archivo que define cada símbolo.

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
- Auditoría de edición: `updateExistingQuoteCore` registra **el mismo formato que ventas** — cambios de cabecera + diff estructurado `itemsDiff` (`buildSaleAuditDiff` de `server/sales/saleAuditDiff.ts`, con `dateLabel: 'Fecha'`; los ítems se emparejan por id, que el drawer conserva). Sin cambios reales no se registra evento. Eventos viejos (sin `itemsDiff`) muestran un resumen corto + filas campo a campo.
- Auditoría de conversión: `logCreate('sale')`, `logCreate('prescription')` si aplica, `logCreate('customer')` si se creó inline, y `logUpdate('quote', before/after)` con estado, `conversionSaleId` y `customerId`. El historial muestra "Convertido en venta #NNNN" y "Cashea activado".

**Inventario y prescripción**

- La quote no toca stock; stock solo al convertir vía `insertSaleItem` → `consumeFifoForSaleItem` (FIFO de lotes, movimientos `SALE_OUT`, caché de stock). Stock insuficiente lanza y revierte toda la tx — **misma política que venta nueva**, sin política nueva. El preview de conversión solo clasifica/avisa (`untracked` para ítems libres y lentes ON_DEMAND), nunca bloquea.
- **Precio presupuestado respetado (D8):** si el catálogo cambió de precio, el modal avisa `USD 280 → 295` pero la conversión usa `unitPrice` del ítem. No existe botón "Actualizar precios": para usar el precio nuevo hay que editar el presupuesto.
- Fórmula del cliente al convertir: la elige el modal (`primaryQuoteItemId`, radio por cristal + "Ninguna"); `undefined` = default `defaultPrimaryLens` (un cristal y ningún nombre). Solo ese cristal crea la `isCurrent` (desde su snapshot, incl. altura OD/OS) y se enlaza; "Ninguna" no crea ni pisa nada. `derivePrescriptionFromQuoteItems`/`firstDefined` eliminados.
- **Agrupación por persona** (`quote_item_groups` + `quote_item_group_members`, espejo de ventas sin principal): create/update la guardan (update reinserta ítems con el mismo id cliente; `groups` ausente = conserva y clampa). Identificadores derivados por posición (`P-0055-1`, `P-0055-2`) visibles en wizard (paso 2 con draft/cancelar + paso 3 resumen), detalle (Lista y Por persona con paridad visual), edición y conversión; reorganizar un presupuesto con grupos guardados pide confirmación (`ReorganizeGroupsConfirm`). La conversión **copia** grupos, nombres y reparto (`remapGroupItemIds` con el mapa quoteItem→saleItem). **Duplicar** conserva el emparejamiento con ids nuevos y limpia los nombres (`clearLabels`), avisa (toast + banda) y nunca bloquea. Reglas en `docs/agents/sales.md` (Agrupación por persona).

**Escrituras**

- Todo write en una sola tx; las query functions aceptan `executor: DbOrTx = db` y reciben `tx`. `resolveInlineCustomer` pasa el executor hasta `findCustomerByIdNumber` para que el chequeo de cédula duplicada vea la tx (rollback si duplicado). Audit siempre **después** de la tx (best-effort).
- Numeración por **sequence** de Postgres (migración 0053): `quotes_quote_number_seq` con `setval(MAX+1, false)`, `OWNED BY quotes.quote_number`, unique index ya existente en `quote_number` + guard de duplicados en la migración. `getNextQuoteNumber` (MAX+1) **eliminado**: `createQuote` deja que la DB asigne el número vía `.returning()`. El `getQuoteNumberPreview` (MAX+1) es solo informativo/etiquetado en código como "puede cambiar al guardar".

**Duplicar (D7)**

- Permitido desde cualquier estado (borrador, convertido, cancelado). Ruta `/quotes/new?from=<id>`; el loader delgado entrega `{quote, items}` al wizard. `quoteToWizardDraft()` (puro, con spec) copia ítems (mismo cristal/producto/libre, tratamientos hijos), descuento, isCashea y notas; resetea cliente, fecha (hoy), validUntil (vacío) y número (preview nuevo).
- ⚠️ **Ids nuevos por ítem:** cada ítem duplicado recibe `crypto.randomUUID()` y los tratamientos se remapean al id nuevo de su lente. Reusar los ids del origen violaba `quote_items_pkey` (`insertQuoteItems` usa `item.id`). Dos presupuestos son independientes aunque tengan el mismo ítem (la quote no mueve stock).
- ⚠️ **La fórmula NO se copia:** solo se conserva qué ojos aplican (`enabled`); esfera/cilindro/eje/adición/altura quedan vacíos y el paso 2 los exige otra vez (`hasLensPrescriptionErrors`). Evita presupuestos con una graduación arrastrada por error. Guarda `sourceQuoteId` (FK self, ON DELETE SET NULL, índice). El historial y el detalle muestran "Duplicado de P-0231" (el loader resuelve el número del origen).

## Endpoints (remote)

- `listQuotes({page, perPage, status?, statuses?, sellerId, dateFrom, dateTo, search, isCashea?, sort})` → `{quotes,total,page,perPage,totalPages,selection}`. `statuses` (multi-select de pestañas, como ventas) manda sobre `status` y se serializa en `?status=DRAFT,CONVERTED` (`parseQuoteStatuses`/`serializeQuoteStatuses` en `list/quoteListParams.ts`). `sort`: `recent|total|expiring` ("vencen primero"). `getQuoteFacets()` → conteos por estado respetando los demás filtros. `getQuoteStats()` → KPIs globales: `open/openTotal` (DRAFT), `monthly/monthlyTotal` (creados desde inicio de mes por `quoteDate`), `monthlyConverted` (CONVERTIDOS **de la misma cohorte** creada desde inicio de mes); **tasa de conversión = monthlyConverted / monthly** (0 si monthly=0), redondeada al entero en la UI. La cohorte evita que el numerador supere al denominador (un quote viejo convertido este mes no cuenta).
- `getQuoteConversionPreview(id)` → por ítem `{quoteItemId,label,stock:{kind:'ok'|'insufficient'|'untracked',available?,needed},price:{quoted,current,changed}}` y resumen `{allStockOk,priceChangedCount,missingCustomer}`. La **misma query** alimenta el bloque "Si se convierte hoy" del hero y la sección "Revisión" del modal. Clasificación pura en `shared/quotes/conversionPreview.ts` con spec (vivía en `server/quotes/`, se movió para que queries/remote/UI la consuman sin invertir capas).
- `saveQuoteItemGroups({quoteId, groups})` (`commands.remote.ts` → `server/quotes/saveQuoteItemGroups.ts`): guardado solo-grupos desde "Organizar" del detalle; solo DRAFT.
- `convertQuoteToSale({id, customerId?, newCustomer?, isCashea?, primaryQuoteItemId?})` → valida fuera de tx, crea cliente inline dentro, recompone la venta con `createSale(data, tx)`, ítems con `insertSaleItem(tx, …)`, guard de concurrencia y audit after-tx. El cliente asignado se escribe en la quote en la misma tx. Devuelve `{success:true, sale}` con `orderNumber` para el toast.
- `assignQuoteCustomer` **eliminado** (D5): el link "Asignar cliente ahora" del hero abre el modal de conversión en modo sin cliente; la conversión asigna el cliente y crea la venta en una sola tx. Su schema y su spec de remote también se eliminaron.
- `getQuoteNumberPreview()` (query) → número preview no reservante para el wizard.

## Patrones locales

- Remote = shell (auth + delegación a `*Core` con `ActionContext`), mismo patrón DT9 que `sales`.
- Helpers puros de quotes en `src/lib/server/quotes/quoteHelpers.ts` (buildQuoteItemValues). `toSaleTotalsLine` y `resolveLensSnapshotCosts` viven en `$lib/shared/` (fuente única compartida con ventas; consolidaron los duplicados de `remote/{quotes,sales}/helpers`). **Ningún archivo de `server/` importa de `remote/`**.
- **Reuso de componentes de ventas (plan quotes-redesign):** hero navy con CSS compartido en `$lib/components/layout/heroNavy.css` (container queries `<700/≥700/≥1500` contra `.page`, nunca viewport; tope 1760px); `SaleDetailHeroCustomer` con `emptyState` opcional; `SaleItemsTable` en solo lectura vía `groups`/`headerBadge` opcionales y el adapter `quoteItemsAdapter.ts`; historial con la **misma UI que ventas**: `classifyQuoteAuditEntry` produce el `AuditEvent` de `$lib/utils/saleDetail` (con `note` para "Duplicado de P-0231"/"Cashea activado"), `QuoteAuditTimeline` renderiza `SaleAuditEvent` (rail denso con «N cambios →») y `QuoteAuditHistoryDrawer` envuelve `sales/detail/AuditEventsDrawer` (shell compartido con `SaleAuditHistoryDrawer`: filtros Todos/Ediciones/Estados, detalle artículos/datos/totales). `SaleListHeader`, `SaleFilterBar`, `SaleStatusTabs`, `SaleFilterChips`, `SaleListFooter` se generalizaron con props opcionales (ventas sin cambios visuales). `QuoteDetailMobileBar` replica `SaleDetailMobileBar` (barra inferior + hoja "Más").
- **Listado móvil = ventas (<700px de contenedor):** contexto `quoteListContext.ts` + plantillas `QuoteListMobile`/`QuoteListDesktop` + `QuoteMobileOverlays` (fuera del `@container`), igual que `/sales`. Reusa `SaleMobileControls` (buscador + Filtros sticky), `SaleMobileFilterSheet` (hoja de filtros con `sortOptions`/`toggleOptions`/unidad por props), `SaleListFooter narrow` (selección plegable + ‹ Anterior · Página X de Y · Siguiente ›), `Fab` ("Nuevo presupuesto") y `Carousel` (KPIs). Tarjeta `QuoteCard` con `density` compact/comfortable y ⋯ que abre `QuoteRowActionsSheet`; el gating del ⋯ vive en `quoteRowActions.ts` (lo comparten popover y hoja).
- **Vista Lista/Cuadros compartida con ventas:** misma llave `LIST_VIEW_PREFERENCE_KEY = 'sales.view'` (`sales/listParams.ts`) y mismo guardado `persistListView` (`sales/listViewPreference.ts`). Cambiar la vista en un listado la cambia en el otro; no existe llave propia de presupuestos.
- Filtro **Cashea** en el listado (`?cashea=1`, switch en el popover/hoja y chip). Las tarjetas/filas muestran la fecha del presupuesto (`quoteDate`, día de negocio), no `createdAt`.
- **Editar (D1):** `EditSaleModal` parametrizado con `quote`/`quoteItems` + `quoteEditAdapter.ts`; sin motivo, sin reversión de stock, Cashea + Válido hasta en la meta bar, guarda con `updateExistingQuote`, toast "Presupuesto actualizado", solo DRAFT. El wizard usa `SaleStep1Info`/`SaleStep2Items`/`SaleStep3Summary` (el wrapper `QuoteStep3Summary` se borró).
- **Conversión (D2):** un único modal de revisión, no wizard. Cliente inline se resuelve con `CustomerLookupInput`, se envía como `newCustomer` (no se crea al tipear). `Crear venta` con `aria-disabled` + `TriggerTooltip` "Falta completar: Cliente" + línea inline en táctil; doble clic protegido. Éxito: toast `Venta #NNNN creada desde P-XXXX` y navegación directa a `/sales/<id>` (comportamiento previo de la app). El overlay usa `bits-ui` `Dialog` (cierre con Escape, foco y portal), no un `div` artesanal; `onclose` del padre controla el estado.

## Testing

- ⚠️ **Cobertura Sonar:** `vite.config.ts > coverage.include` es una lista blanca; todo `.ts` nuevo fuera de `server/remote/shared/schemas` debe agregarse (quotes: `components/quotes/**/*.ts`) o Sonar lo cuenta en 0 % aunque tenga spec. Int de lecturas: `queries/quotes/reads.int.spec.ts` (relaciones, filtros, preview de conversión, remotes de lectura con `callRemote`).
- Unit (nuevos tras la review del PR): `components/quotes/list/quoteRowActions.spec.ts`, `components/sales/listViewPreference.spec.ts`, `QuoteAuditHistoryDrawer.svelte.spec.ts` (detalle de ítems como ventas). Int: `updateExistingQuote.int.spec.ts` cubre el `itemsDiff` anexado y "sin cambios ⇒ sin evento".
- Unit: `schemas/quotes.spec.ts`, `shared/quotes/{quoteValidity,conversionPreview}.spec.ts`, `components/quotes/detail/{quoteAudit,quoteItemsAdapter,QuoteAuditHistoryDrawer}.spec.ts`, `components/quotes/duplicate/quoteToWizardDraft.spec.ts`, `components/quotes/editQuote/quoteEditAdapter.spec.ts`, `components/quotes/list/{quoteListParams,quoteListDisplay}.spec.ts`, `shared/{saleTotals,saleItemCosts}.spec.ts`, `components/sales/detail/saleBreakdown.spec.ts`. Int: `server/quotes/{createNewQuote,updateExistingQuote,convertQuoteToSale}.int.spec.ts` (incluye rollback por duplicado, cliente inline, doble conversión concurrente, no-DRAFT, stock insuficiente, altura y `quoteDate` editado), `queries/quotes/list.int.spec.ts` (KPI de cohorte, multi-estado, `markQuoteConverted` directo), `remote/quotes/commands.int.spec.ts`. E2E `e2e/quote-to-sale.test.ts` (con cliente y con cliente inline desde el modal).
- Los int specs requieren Docker/Testcontainers (`project=integration`); en CI corren en el job Integration Tests.

## Known gaps / tech debt

- 🟡 Las quotes no registran medidas de montaje (DP/NP) en sus ítems; la conversión no copia medidas a la venta (mismo hueco de larga data). El preseed del editor de lente usa `null` para esas medidas.
- ~~🟠 `getNextQuoteNumber` = MAX+1, no a prueba de concurrencia~~ **Resuelto (2026-11-19, #229):** sequence de Postgres + preview no reservante.
- ~~🟡 Inversión de capas `server/quotes/* → $lib/remote/quotes/helpers` + `resolveLensSnapshotCosts` duplicado~~ **Resuelto (2026-11-19, #229):** `remote/quotes/helpers.ts` borrado; cores usan query fns con executor.
- ~~🟡 Conversión quote→venta numeraba con `getNextOrderNumber` (MAX+1)~~ **Resuelto (2026-11-19, #231):** el número lo asigna la sequence de ventas `sales_order_number_seq`; ver `docs/agents/sales.md` → Numeración.

## Planes completados

- **2026-11 · quotes-altura** — Altura por ojo en presupuestos (DT15)
- **2026-11 · quotes-redesign** — Presupuestos rediseñados con componentes de ventas (lista, detalle, edición, conversión con preview); numeración por sequence y duplicar desde cualquier estado (#229)
