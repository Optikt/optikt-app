# sales (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Ventas ópticas: wizard con receta, items polimórficos (`PRODUCT | LENS_PAIR | TREATMENT | FREE_ITEM`), cobros multi-moneda con tasa BCV, máquina de estados por pieza (preparado para retiro), edición con reversión FIFO de inventario y cancelación con reembolso a caja. Lógica en `src/lib/server/sales/*Core` (patrón shell/core DT9); remotes son shells de auth + delegación (`remote/sales/lifecycle.remote.ts:1-15`).

## Scope

`components/sales/**`, `routes/(app)/sales/**`, `remote/sales/**`, `server/sales/**`, `queries/sales/**`, `schemas/sales*`, `schema/sales.ts`; lógica pura `shared/saleTotals*`, `saleItemCosts*`, `saleItemValues`, `tickera*`, `ticketRate*`, `saleBalance*`.

Owner rules: el consumo FIFO de venta vive acá pero delega en `inventory` (`consumeFifoForSaleItem`); los pagos usan el factory transversal de `payments` (`server/payments/salePayments.ts`) pero con semántica propia de venta (documento abajo).

## Reglas de dominio / invarianzas

**Máquina de estados** (`schema/sales.ts:54-55`, `server/sales/setSaleStatus.ts`)

- `PENDING → IN_PROGRESS → READY → COMPLETED` + `CANCELLED`. Pagar completo **no auto-completa**: la transición es manual vía `setSaleStatus`.
- Adelante: cualquiera con `canManageSaleByOwner`. Hacia atrás: solo ADMIN/MANAGER **con motivo obligatorio** (`setSaleStatus.ts:45-61`, flow en `SALE_STATUS_FLOW:11-16`); `completedAt` se set/clea en `:63-72`.
- `CANCELLED` es terminal: bloquea set-status (`:30-35`), edición (`updateSale.ts:43-45`) y pagos nuevos (`addSalePayment.ts:15-17`).
- Void de pago que deja la venta subpagada revierte estado (COMPLETED→PENDING limpia `completedAt`; READY subpagado→IN_PROGRESS), tolerancia **0.01** (`voidSalePayment.ts:43-49`).

**Pagos** (`server/sales/addSalePayment.ts`, `queries/sales/payments.ts`)

- `paidAmountBcvUsd` **siempre se recalcula** desde la suma de pagos no-voided (`recalcSalePaidAmount`, `queries/sales/payments.ts:89-103`) — nunca incremental.
- `amountBcvUsd` es el que **ingresa el usuario en USD** (evita drift de float; `addSalePayment.ts:19-21`). Métodos Bs no requieren `exchangeRate`; los extranjeros sí; `bcvRate` siempre obligatoria (`addSalePayment.ts:23-25`, `schema/sales.ts:287-297`).
- El pago se registra vía factory `submitSalePayment` (`server/payments/salePayments.ts:21-43`): insert + recalc en la MISMA tx del caller.
- Void = soft-delete con `voidedAt` (idempotente) + `voidedById`/`voidReason` obligatorios (`VoidPaymentSchema.reason` 1–500; mig. `0051`); encontrar el pago exige que pertenezca a la venta y esté sin void (cross-sale void rechazado).
- Quién: `sale_payments.createdById` (cobró) y `voidedById` (anuló), nullable pre-feature; `getSalePayments` devuelve `SalePaymentWithUsers` (`createdByName`/`voidedByName` vía left join a `users`, `queries/sales/payments.ts`). Viejo sin datos ⇒ "—" en UI.
- Historial de pagos: `SalePaymentsHistoryDrawer.svelte` (SlideOver `w-full sm:w-[440px]`): franja Total/Cobrado/Saldo + tarjeta por pago (original, tasa congelada+tipo, fecha-hora, registrado por, referencia, equiv. USD BCV, notas; anulado `bg #fbfafb` + motivo/quién/cuándo). Anular (card ⋯ o drawer) = `ConfirmModal` con motivo obligatorio inline + toast. Filas sin truncar (`overflow-wrap:anywhere`); tasa BCV mono + `TriggerTooltip`; sin `title` nativos.
- ⚠️ Editar items reduciendo `total < paidAmount − 0.01` se **rechaza** (redirigir a cancelar + recrear) — `updateSale.ts:133-139`.

**Items / modificadores**

- `LENS_PAIR` exige receta al momento (snapshot OD/OS en `sale_items`); `TREATMENT` es hijo con `parentSaleItemId` y debe compartir proveedor con el cristal — validado en create (`createSale.ts:43-46`) y edit (`updateSale.ts:104-109`).
- Medidas de montaje snapshot en `sale_items` (`dp`, `np_right`, `np_left`, opcionales): escritas en create (`wizardSubmission.ts` `buildSaleItemsFromWizard`) y edit (`editSaleLensAdapter.ts`); migración `0048` backfilla desde la receta vinculada. Ausentes → "—" en `LensRxPanel` y aviso ámbar solo si falta ALT/DNP en progresivos/bifocales (`missingMountingMeasures`); DP nunca es obligatorio. La conversión cotización→venta aún no copia medidas (mismo hueco que ALT).
- `FREE_ITEM` no consume FIFO y tiene fila 1:1 `sale_item_free_details` con `enrichment_status PENDING→ENRICHED` (`server/sales/enrichFreeItem.ts:15-62`).
- Costos snapshot post-venta solo del módulo lens: `updateItemCosts` recalcula `snapshotCostTotal/Unit` (`updateItemCosts.ts:21-37`).
- ⚠️ **El commit del editor de cristal se construye desde el `lensDraft` (lo que el usuario editó), nunca desde `lensBase` (copia del mount)**: `EditSaleLensEditor.commitDraft` debe pasar por `editableItemFromLensEditorDraft(lensBase, lensDraft)` antes de `buildLensInputFromDraft`. Regresión del rework v2 (`4c266b58`) que descartaba precio/fórmula/cantidad **y el `lensCatalogItemId`** (items guardados sin enlace al catálogo → sin nombre ni stock). Cubierto por `EditSaleLensEditor.svelte.spec.ts` (2 tests: editar existente + agregar nuevo).
- Edición de items = **reseteo completo del inventario** (revert con `EDIT_REVERT` + motivo en `notes` + re-consumo) en una sola tx; items viejos soft-delete en cascada (`updateSale.ts:36-37,178-308`). Falla si COMPLETED (`:51-53`) o no-ADMIN si IN_PROGRESS/READY (`:55-64`).

**Dinero (subtotal / total / tasas)**

- Semántica de subtotal: la suma cruda de líneas con IVA incluido (post descuentos de línea). Cobrado: `total = max(0, rawSubtotal − descuento global)`. Helper puro `computeSaleTotals` (`shared/saleTotals.ts:37-72`; impuestos: PRODUCT gravable por default, resto exento).
- ⚠️ Tasa BCV congelada `snapshotBcvRate` (NULL = pre-feature): se captura viva al submit de create/edit; si la API cae queda NULL y tickera cae a tasa viva vía `resolveTicketRate` (`createSale.ts:59-61`). Cambiar la fecha NO cambia la tasa (pertenece al evento).
- Comparaciones de "¿pagado?" usan tolerancia 0.01.

**created_at como fecha-verdad** (plan sale-createdat-truth, en git history)

- `sale_date` eliminada: `created_at` es la única fecha (día del form + hora del submit, compuesta en Caracas UTC-4 por `composeBusinessTimestamp`). El alias `saleDate` del schema lo mapea el server (`createSale.ts:108-110`, `updateSale.ts:293-294`). No reintroducir `saleDate` como columna.

**Inventario**

- PRODUCT: FIFO completo (lotes + movimiento `SALE_OUT` + caché stock), con `sale_items.lotId` = lote primario (`queries/fifoConsumption.ts:56-120`, `schema/sales.ts:152-153`). Lente STOCK/no-product: solo decremento de contador.
- Cancel/edición: `revertSaleInventory` devuelve **solo el neto pendiente por lote** (agrupa `SALE_OUT` + `*REVERT` de la venta y revierte únicamente el saldo negativo) + movimiento espejo (`EDIT_REVERT` con `notes: Edición: <motivo>` en edición, `CANCEL_REVERT` en cancelación real; lo viejo queda `CANCEL_REVERT`, sin migración de datos) — `server/sales/revertSaleInventory.ts`, usado por `cancelSale.ts` y `updateSale.ts`. ⚠️ No reviertas cada `SALE_OUT` a ciegas: el log es inmutable y una segunda edición re-revertiría lo ya revertido (duplicaba stock del lote). Lote con neto ≥ 0 se salta (cubre datos fantasma pre-existentes).

**Cancelación / reembolso**

- REFUNDED registra egreso en caja `createExpense(category=REFUND, currency USD, reference SALE:<id>)`; los pagos quedan activos (offset del ingreso en el P&L de `cash` — ver ese doc) — `cancelSale.ts:135-161`.
- `RefundStatus` sincronizado: sin pagos → `NO_PAYMENT` forzado (`cancelSale.ts:116-131`).
- Audit best-effort SIEMPRE después de la tx, con `excludeFields` fijos.

**Listado de ventas (plan `sales-list-redesign`)**

- **Saldo** = helper puro único `src/lib/shared/saleBalance.ts` (`saleBalance`, `saleHasBalance`, `saleIsPaid`, `salePaymentPercent`, `SALE_PAID_EPSILON = 0.01`; canceladas ⇒ no aplica). Es la fuente para la celda de saldo, las KPIs, el pie de selección y el detalle — **no recalcularlo en componentes**.
- `getSalesStats` es **global** (no reacciona a filtros) y en una sola query devuelve `total`, `monthly`, `monthlyTotalUsd`, `pending/completed/cancelled/ready`, `receivableCount/receivableAmount` (por cobrar = no canceladas con saldo > 0.01).
- Filtros nuevos del listado: `balanceOnly` (`SaleFilterOptions`) y `orderBy: 'balance'` (`SaleOrderBy`, expresión SQL con canceladas al final). Facetas: `countSalesByStatus` (GROUP BY ignorando `statuses`) y `sumSalesForSelection` (selección sin canceladas); ambos reusan `buildSaleConditions`.
- `getAllSales` agrega `hasShippingPending`/`hasFreeItem` (dos `EXISTS` correlacionados en el SELECT) y devuelve `SaleListItem`. `getSalesListPage` centraliza página+total+facetas+selección (lo usan el load y el remote `listSales`: sin lógica duplicada).
- Contrato de URL (aditivo): `q, status, shippingPending, freeItem, cashea, balance, seller, from, to, sort, per, view, page` — parseo tolerante en `components/sales/listParams.ts` (+ spec) y `statusFilter.ts`.
- Acciones rápidas: el listado **navega** a `/sales/[id]?action=pay|status`; el detalle consume el parámetro una vez, valida con sus mismos guard, lo limpia con `replaceState` y muestra toast si no aplica. Contrato reutilizable: `docs/specs/action-intent-param.md`.
- `SaleStatsCards` fue **eliminado** (sus 4 números viven en las KPIs + pestañas de estado).

**Numeración**: `orderNumber` secuencia MAX+1 dentro de la tx; override numérico (backfill) solo ADMIN con validación de duplicado (`createSale.ts:25-31,91-100`).

**Detalle layout (B+ §3-A)**: `.page` (`routes/(app)/sales/[id]/+page.svelte`) tope 1760 + `container-type: inline-size` (sin viewport queries para layout); hero (`SaleDetailHero.svelte`) con hijos directos `hl hc2 mon acts hcta` y `grid-template-areas` (700–1499 dos cols `290px`; ≥1500 tres zonas `1.05fr/1fr/330px` vía `@container`, cliente `hc2` a toda altura). Rail `360px ≥1060 / 420px ≥1500` (container).

**Detalle stock (B+ §3-C)**: `SaleStockDrawer.svelte` (SlideOver `w-full sm:w-[440px]`, reemplaza el uso de `SaleMovementsModal` — el archivo viejo se conserva) sobre los mismos `movements` del loader: subtítulo «N movimientos · efecto neto», tabla neto por producto (Producto·Salidas·Reversiones·Neto, 0 en gris), píldoras Todos/Salidas/Reversiones y grupos por operación (más reciente primero: «Edición · fecha · usuario» / «Creación de la venta» / «Cancelación», clave `referenceType+referenceId+usuario+minuto`). Lógica pura en `saleStock.ts` (+ `saleStock.spec.ts`).

**Detalle auditoría (B+ §3-D)**: `updateSale` anexa `changes.itemsDiff` (schema `SaleAuditDiff v1`, `schemas/sales.ts`) al evento «Venta actualizada», calculado puro post-tx (`server/sales/saleAuditDiff.ts:buildSaleAuditDiff`, tope 50 + `truncated`). Empareja por `id` cliente; `swap` = cambio de producto; hijos tratamiento re-creados sin id = `add`/`del`. Costos internos excluidos por allowlist (nunca en el diff). Eventos viejos sin diff ⇒ aviso en cursiva sin despliegue. Timeline fusiona `sale` + `sale_payment` (registrado/anulado; el void ahora audita `sale_payment` en `voidSalePayment.ts`) vía `queries/changeHistory.ts:getSaleAuditHistory(+Count)` + remote `history.remote.ts:getSaleAuditHistory` (limit/offset, «ver más»). UI: `SaleAuditTimeline` (3 recientes + «N cambios · Total ±» abre expandido), `SaleAuditHistoryDrawer` (filtros Todos/Ediciones/Estados), `SaleAuditEvent` (secciones ARTÍCULOS/DATOS/TOTALES, chip Total ±, MOTIVO destacado, estados como pills). Sin `title` nativos.

**Listado móvil (plan `sales-list-mobile`, contenedor <700px)**

- **Detección**: `ResizeObserver` sobre el contenedor de la página (`isNarrow = width < 700`, mismo patrón del detalle) en `+page.svelte`; la plantilla cambia entre `SaleListDesktop` / `SaleListMobile`. FAB y hojas montan **fuera del contenedor `@container`** (`fixed` + containment son incompatibles — `SaleMobileOverlays.svelte`).
- **Estado compartido**: `saleListContext.ts` (patrón wizardContext, Symbol key): el page publica getters + `handlers` + `mobileUi` (hojas móviles); escritorio y móvil consumen el MISMO contrato. Sin duplicar lógica de filtros/URL.
- **Shell móvil**: barra con selector de vista solo iconos (`SegmentedToggle iconOnly`), «Nueva venta» sale del header al FAB (toast «Vista guardada» al cambiar). KPIs en `Carousel` (232 px, tercera asoma, dots que siguen al scroll). Buscador+Filtros sticky (`SaleMobileControls`, sombra al pegarse via sentinel + IntersectionObserver). Pestañas y chips en `ScrollableRow` (una fila, máscara, re-alinea la activa).
- **Hoja de filtros** (`SaleMobileFilterSheet`): SlideOver bottom + `dragClose`; vendedor/fecha/mostrar solo/ordenar aplican AL INSTANTE (URL incluida); «Ver N ventas» con conteo en vivo vía remote `countSales` (`CountSalesSchema` = ListSales sin paginación, reusa `countSales` query) — debounced 300 ms.
- **Tarjeta**: `SaleCard` única con `density: 'comfortable' | 'compact'` — compact = fila densa (~88 px) con bloque de saldo fijo 116 px y flags en fila 1; comfortable = tarjeta rica de Cuadros. `SalesGridView` pasa `density` y `onMenu`.
- **Acciones ⋯**: gating único en `saleRowActions.ts` (+ spec) consumido por `SaleRowMenu` (popover escritorio, `size: sm|lg`) y `SaleRowActionsSheet` (hoja inferior móvil: header #·cliente + estado·saldo, filas 54 px, cancelar rojo; mismas navegaciones `?action=pay|status`; cancelar abre `CancelSaleModal` del listado). VIEWER solo «Ver detalle».
- **FAB**: `Fab` del kit, dorado, `hidden={!isNarrow || !canAct}`, contrae/oculta/reaparece con el scroll del `<main>`.
- **Pie móvil**: `SaleListFooter` variante `narrow` (resumen de selección plegable Total/Cobrado/Saldo + paginación ‹ X de Y › sin números, sin «por página»); al paginar hace scroll al top (`onPageChange(_, { scrollTop: true })`). `aria-live` de resultados ya existente.
- **Shell (todas las secciones, <lg)**: búsqueda global plegada en icono de lupa (`MobileGlobalSearch`, lógica compartida con escritorio); sin segunda fila de búsqueda. Ítems del menú lateral `min-h-11` (NavLink). Isotipo solo en xs (la barra completa no cabe).

**Detalle móvil (B+ §3-E, <700px contenedor)**: el sidebar global ya es overlay en viewport móvil (hamburguesa en `AppNavbar`, velo que cierra al tocar, `translate-x-full`↔abierto) — no se tocó para no romper otras rutas; nombre oculto <640 y búsqueda en segunda fila (patrón global existente). En la página: `+page.svelte` mide el contenedor `.page` con `ResizeObserver` (`isNarrow = width < 700`, el sidebar reacomoda el switch) y solo entonces monta `SaleDetailMobileBar` (fuera del contenedor: `fixed` + `container-type` son incompatibles) + `.mobile-spacer` de 96px. Hero 1 col: título 24, stepper compacto (etiqueta solo en paso actual, resto puntos), meta 2 col, dirección envuelve (`SaleDetailHeroCustomer`), dinero 2 col (Total+Bs | Saldo+Bs con divisor) + Desglose/Calcular full-width; barras decorativas ya ocultas <700. Acciones desktop (`hero-acts`/`hero-hcta`) ocultas <700; la barra fija lleva CTA dorado Cobrar/Imprimir + «Más» (hoja `SlideOver direction="bottom"`: estados con descripción, editar, imprimir ×3, calcular, pagos, historial, stock, separador, cancelar rojo — mismos guards que `SaleDetailHeroActions`). Artículos como tarjetas (`SaleItemsRow` flex: cabecera arriba, USD izq/Bs der abajo; subtítulo envuelve), header oculto, hijos sangría 36, fórmula full-row. Drawers ya `w-full sm:w-[...]`; calculadora `w-full sm:w-[580px]` + columnas compactas `sm:`; modales `ConfirmModal`/`Dialog` ya full-width (`max-w-[calc(100%-2rem)]`). Rail pagos/historial apilado <700 (`grid-cols-1 @min-[700px]:grid-cols-[1fr_1fr]`).

## Patrones locales

- **Shell/core (DT9)**: lógica = `<acción>Core(input, ctx)` en `server/sales/<acción>.ts` con `ActionContext` explícito; remote solo `requireRole` + delega. Es el patrón de referencia para otros dominios.
- **Int specs co-ubicados** junto al core (`server/sales/*.int.spec.ts`, Postgres real/Testcontainers).
- Lógica pura de negocio en `src/lib/shared/` (ver Scope). Helper compartido de snapshot costs con quotes: `resolveLensSnapshotCosts` (⚠️ duplicado, ver deuda).
- Queries `queries/sales/` divididas (DT1): `reads|writes|items|payments|shared|types` — algunas aún usan `db` fijo.
- Gate de tamaño de archivo (`scripts/check-file-size.sh`) activo en este dominio; partes descompuestas por plan `dt1-t2-sales`.

## Testing

- Cores: `*.int.spec.ts` co-ubicados (lifecycle create/cancel/setStatus/update, voids con recálculo + quién/motivo, FIFO cancel/update, `saleRevertOrigin` — edición escribe `EDIT_REVERT` con motivo, cancelación `CANCEL_REVERT`, free-item enrichment; `updateSaleAuditDiff` — el `itemsDiff` v1 se guarda sin alterar totales/inventario, header-only y no-op, el void audita `sale_payment`).
- Unit del diff: `server/sales/saleAuditDiff.spec.ts` (add/del/swap/mod por campo, fórmula OD/OI, montaje, tratamiento hijo sin id, descuento global, Cashea, totales numéricos, costos excluidos, tope 50+`truncated`).
- Schemas: `schemas/sales.spec.ts` (incl. `VoidPaymentSchema`: motivo obligatorio 1–500). Unit puros espejados en `components/sales/**` (pricing, taxBreakdown, paymentForm*, editSale*, wizard*, etc.).
- Componentes (`project=client`, browser): `editSale/EditSaleLensEditor.svelte.spec.ts` — el «Hecho» del editor de cristal debe entregar al `onApply` lo editado en el draft (precio, graduación, enlace al catálogo).
- Listado: `shared/saleBalance.spec.ts`, `components/sales/listParams.spec.ts`, `components/sales/saleDisplay.spec.ts`; gating del ⋯ compartido: `components/sales/saleRowActions.spec.ts`; a nivel DB `queries/sales/list.int.spec.ts` (stats/facetas/selección/saldo/flags) y `queries/userPreferences.int.spec.ts` (ambos `project=integration`, requieren Docker).
- E2E de dinero: `e2e/sale-payment.test.ts`, `e2e/quote-to-sale.test.ts`.

## Known gaps / tech debt

- 🟡 `updateSaleFifo.int.spec.ts` existe pero **su fuente `updateSaleFifo.ts` aún no** — spec avanzado del plan; extraer la lógica FIFO de update antes de confiar en el spec.
- 🟡 `PaymentForm` family: el state factory vive en `components/sales/payments/` aunque la UI adapter está en `components/payments/` (herencia del factory transversal) — mover al unificar pagos (plan pr5).
- 🟡 `resolveLensSnapshotCosts` duplicado (`remote/quotes/helpers.ts` vs `remote/sales/helpers.ts:35-58`) — consolidar en `src/lib/shared/`.
- 🟡 Fecha-verdad (composición Caracas) pendiente para: `sale_payments.paymentDate`, `purchase_orders.orderDate`, `quotes.quoteDate`, `prescriptions.prescriptionDate` .

## Planes completados

- **2026-11 · sales-list-mobile** — Listado /sales en móvil + búsqueda global plegable en el shell (kit móvil compartido, mockup ventas-listado-mobile) (#228)
- **2026-11 · detalle-venta-bplus** — Detalle de venta B+: pantallas grandes, pagos con quién+motivo, stock drawer, historial con diff y móvil (#225)
- **2026-11 · dt1-t2-sales** — sales/[id] 792→~300 (luego 504 con B+) + 6 secciones detail/ + saleDetail.ts con spec (#122)
- **2026-11 · redesign-sale-detail-view** — Rediseño total de /sales/[id] según mockup B: hero navy, artículos, pagos, calculadora de factura, tasa Modo A/B (#216)
- **2026-11 · rework-editar-venta-ui-ux** — Editor de venta rehacedo: cristal con errores inline, rango óptico warning-confirmable, documentEditor compartido listo para quotes (#193, #208, #209)
- **2026-11 · sale-createdat-truth** — sales.sale_date eliminada: created_at única fecha-verdad con composeBusinessTimestamp (día form + hora Caracas); resto de módulos queda como DT22
- **2026-11 · sale-subtotal-fix** — subtotal = BI+Exento pre-impuesto en ventas y quotes; total intacto; helper computeSaleTotals + backfill 0042
- **2026-11 · sales-list-redesign** — Listado /sales rediseñado: KPIs globales, vistas Lista/Cuadros, pestañas facetadas, ?action= (patrón agnóstico), user_preferences por perfil
- **2026-11 · tickera-rate-freeze** — Tasa BCV congelada por venta (snapshot_bcv_rate + resolveTicketRate): reimpresiones deterministas (#966ed371)
- **2026-11 · sales-list-mobile** — Listado /sales en móvil (<700px contenedor) + búsqueda global plegable en el shell <lg. Kit compartido: SlideOver dragClose/velo/safe-area, ScrollableRow, Carousel, Fab, SegmentedToggle iconOnly; lógica de búsqueda global compartida (universalSearch + SearchResultsList) entre CommandSearch y MobileGlobalSearch. Listado: saleListContext (estado único escritorio/móvil), KPIs en carrusel, sticky search, pestañas/chips desplazables, hoja de filtros con conteo en vivo (remote countSales), SaleCard density compact|comfortable, gating del ⋯ en saleRowActions compartido entre popover y hoja de acciones, FAB y pie móvil. Verificado con gate + 1331 unitarios + Playwright 360/390/desktop.
