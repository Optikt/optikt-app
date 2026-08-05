---
plan name: purchase-ux-harmonize
plan description: Harmonize purchase detail UI/UX
plan status: done
---

## Idea

Refactor completo de `/purchases/[id]` para armonizar los 4 estados (DRAFT, READY, CONFIRMED, CANCELLED) bajo un mismo shell visual, eliminar duplicación de componentes, y rediseñar el drawer de pagos con métodos de pago (migración de schema incluida).

**Decisiones tomadas:**

- Drawer form: columna única + preview inline compacto (sin scroll en 1280×559)
- Métodos de pago con migración completa: nueva columna `payment_method` en `purchase_order_payments`
- Aside contextual: DRAFT→ValueSummary | READY→ReviewProgress+ValueSummary | CONFIRMED→BalanceCard+BtnPago+ValueSummary+Auditoría | CANCELLED→BalanceCard+ValueSummary+Auditoría

**Trabajo principal:**

1. ✅ **Schema migration** (`0033_purchase_order_payment_method.sql`): enum `purchase_payment_method` + columna `payment_method` en `purchase_order_payments`. Backfill: VES→TRANSFERENCIA_BS, USD_BCV/USD_EFECTIVO→EFECTIVO_USD, USDT→BINANCE_USDT, resto→OTRO. **HECHO** — migración con `statement-breakpoint` estilo Drizzle + journal entry.

2. ✅ **Backend**: Enum `PurchasePaymentMethod` + helpers (`currencyForPurchasePaymentMethod`, `getPurchasePaymentMethodRateLabel`, `requiresPurchasePaymentMethodSpecificRate`). Schema, `addPurchaseOrderPaymentCmd` (acepta paymentMethod, deriva currencyCode), schemas zod, queries y tipos actualizados. `PurchaseOrderPaymentsPanel` legacy eliminado; drawer adaptado a `paymentMethod`. **HECHO** — `pnpm check`/`lint`/`test:unit` (55 archivos, 730 tests) pasan.

3. **Drawer rediseñado** (`PurchaseOrderPaymentsDrawer`): pills de método horizontales (wrap) reemplazan el `<select>`; auto-set moneda derivada + placeholders de referencia. Form columna única (Fecha, Monto con autofocus, Tasa BCV, Tasa específica solo si aplica). Referencia + Notas en Disclosure "Detalles opcionales". Preview inline (barra, NO card navy) `Bs X · USD Y · abono/var` sobre botón Guardar, en vivo. Historial debajo con `AppBadge` de método (col "Moneda" → "Método").

4. **Eliminar duplicación**: Header usa `PurchaseOrderStatusBadge` (maneja pseudo-estado ready) + `AppBadge` (payment terms, review count); elimina pill custom con `animate-ping`/SVG. BalanceCard usa `PurchaseOrderDueBadge` en vez de `dueConfig` local. Botón "Registrar pago" reemplaza SVG inline por `<CirclePlus>` lucide. **StatusStepper eliminado** (header ya comunica estado).

5. **Shell unificado con container queries**: wrapper `@container` + grid `@6xl:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)]` en TODOS los estados (reemplaza `xl:`). `ReviewReadyView` se reduce a SOLO columna principal (detalles compactos + items revisables + condición de pago); quita su grid interno `[1fr_22rem]`, columna derecha y recomputación de `purchaseSummary`. Aside contextual por estado (tabla abajo). MovementsSection solo si `isConfirmed && movements.length > 0`. Cards del aside se marcan `@container` para que su grid interno colapse.

**Responsive:** breakpoints (media queries) + **container queries** (Tailwind v4). 1280×559 primary (`@6xl` activa 2-col), laptop 1440+, mobile 375 (grid colapsa a 1 col, aside tras main, drawer full-width).

## Implementation

### Pasos 1-2 (backend/migración) — ✅ HECHOS

Migración `0033`, enum `PurchasePaymentMethod`, schema, remote, zod, helpers y eliminación del panel legacy completados. `pnpm check`/`lint`/`test:unit` pasan. No tocar salvo bug.

### Paso 5 — Shell unificado + ReviewReadyView slim-down

- `+page.svelte`: envolver el contenido en `<div class="@container"><div class="@container/main grid gap-6 @6xl:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)]">`. Eliminar el branch `{:else}` vs `ReviewReadyView` → siempre grid 2-col.
- Eliminar `<PurchaseOrderStatusStepper>` del template + su import.
- `main` (col izquierda) renderiza SIEMPRE en todos los estados: `PurchaseOrderDetailsSection` (compacto), `PurchaseOrderCreditSchedulePanel` (readonly), `PurchaseOrderItemsTable` (con `showReviewColumn`), `PurchaseOrderMovementsSection` (solo si `isConfirmed && movements.length > 0`).
- `aside` (col derecha) contextual:
  - DRAFT (preparación): `PurchaseOrderValueSummary`
  - DRAFT (ready): `PurchaseOrderReviewProgressCard` (pasar `items`+`zeroPriceCount`) → `PurchaseOrderValueSummary`
  - CONFIRMED: `PurchaseOrderBalanceCard` → botón Registrar pago (`<CirclePlus>`) → `PurchaseOrderValueSummary` → `PurchaseOrderAuditTimeline`
  - CANCELLED: `PurchaseOrderBalanceCard` → `PurchaseOrderValueSummary` → `PurchaseOrderAuditTimeline`
- `PurchaseOrderReviewReadyView.svelte`: reducir a SOLO contenido de columna principal. Quitar el grid interno `grid-cols-1 lg:grid-cols-[1fr_22rem]`, toda la columna derecha (Balance, card navy "Total neto", Margen, `ReviewProgressCard`) y la recomputación de `purchaseSummary`/`totalSale`/`totalProfit`/`netTotalPurchase`/`reviewMarginPercentage` (ya vienen del page vía props). Quedar: detalles compactos + lista items revisables (búsqueda/filtros) + condición de pago. Recibir props ya calculadas.
- Verificar (grep) que `ReviewReadyView` y `StatusStepper` no se importan fuera del page/barrel.

### Paso 4 — Header + BalanceCard dedup

- `PurchaseOrderDetailHeader.svelte`: reemplazar la pill custom de estado (con `animate-ping` + spans SVG) por `<PurchaseOrderStatusBadge status={purchaseOrder.status} isReadyForReview>`. Reemplazar pill "Contado/Crédito" custom por `<AppBadge variant={...}>`. Reemplazar pill "{reviewedCount}/{totalItems} revisadas" custom por `<AppBadge>`. Limpiar imports de SVG/ping. Conservar lógica de botones (Editar/Mark ready/Confirmar dropdown/Cancelar), solo estilos a tokens.
- `PurchaseOrderBalanceCard.svelte`: eliminar `dueConfig` local → `<PurchaseOrderDueBadge dueStatus>` (pasa `showNone`). Verificar (grep) que `BalanceCard` solo se usa en esta página (widget dashboard usa `PurchaseOrderDueBadge` directo, no BalanceCard).
- Botón "Registrar pago" (page aside): reemplazar el SVG inline por `<CirclePlus class="h-4 w-4" />`.

### Paso 3 — Drawer rediseño completo

- Cabecera `SlideOver`: título "Registrar pago" + badge de saldo pendiente (AppBadge).
- **Method pills**: contenedor `flex flex-wrap gap-2`; cada método es un `<button>` pill; activa = `bg-brand-navy text-white`, inactiva = `bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest`. Al click setea `paymentMethod` (la derivación de `currencyCode` ya existe). Eliminar el `<select>`.
- **Form columna única** (`space-y-4`, NO `grid-cols-2`): Fecha del pago; Monto pagado (input con `autofocus` al abrir/`focus` action); Tasa BCV USD; Tasa específica (solo si `needsSpecificRate`). Referencia + Notas dentro de un Disclosure "Detalles opcionales" colapsable (para reducir altura por defecto).
- **Preview inline** (barra, NO card navy): una fila compacta `Bs X · USD Y · Abono {settlementSymbol} Z · Var ±W` (+ sugerencia pronto pago si aplica) arriba del botón Guardar, actualización en vivo con `normalized`/`amountAppliedToDebt`/`exchangeVariance` derivados. Estilo sutil (`bg-surface-container-high rounded-lg px-3 py-2 text-xs font-mono`).
- Historial: renombrar columna header "Moneda" → "Método"; la celda ya usa `PURCHASE_PAYMENT_METHOD_LABELS` con `AppBadge` (verificar). Tabla con `overflow-x-auto`.
- Conservar TODA la lógica de overpayment/void/early-payment-benefit modals y los handlers del backend (sin tocar comandos).

### Token cleanup — slate-* → tokens (todos los componentes tocados)

- `PurchaseOrderBalanceCard`: `text-slate-500` → `text-outline`.
- `PurchaseOrderDetailsSection`: `text-slate-500` → `text-outline`.
- `PurchaseOrderItemsTable`: `text-slate-500` → `text-outline` (thead).
- `PurchaseOrderAuditTimeline`: `text-slate-500` → `text-outline`.
- `PurchaseOrderPaymentsDrawer`: `text-slate-500` → `text-outline` (labels, thead).
- `PurchaseOrderReviewReadyView` (mientras se slims): `text-slate-500` → `text-outline`.
- `PurchaseOrderValueSummary`: marcar `@container`; grids internos responsivos con `@<size>`. Sin cambios de datos.
- Validar contraste 4.5:1 de labels `text-outline` sobre `surface-container-low/lowest` (#75777f sobre #ffffff/#f5f3f6 — OK).

### Responsivo — container queries (Tailwind v4)

- Wrapper: `<div class="@container">`. Grid: `@6xl:grid-cols-[minmax(0,1.72fr)_minmax(17rem,0.78fr)]`. Por defecto (debajo de 1280px wrapper) = 1 columna, aside bajo main.
- Cards del aside (`BalanceCard`, `ValueSummary`): marcar `@container`; sus `grid-cols-2` internos → `@sm:grid-cols-2` para que colapsen solo cuando la card tenga ancho propio suficiente (evita aplastamiento en columna angosta).
- `ItemsTable`: ya tiene `overflow-x-auto xl:overflow-visible` — verificar que con container query sigue OK.
- 1280×559: `@6xl` activa 2-col, main denso, aside con cards en `@container`. Sin scroll horizontal.
- Mobile 375: 1 col, aside tras main, `SlideOver` full-width (existente).

### Verificación

- `pnpm check` → 0 errors/0 warnings (svelte-check).
- `pnpm lint` → prettier + eslint OK.
- `pnpm test:unit` → 55 archivos, 730 tests OK.
- Manual 4 estados a 1280×559, 1440 y 375:
  - DRAFT (preparación): banner + ValueSummary, sin review column.
  - DRAFT (ready): ReviewProgressCard + ValueSummary en aside; items revisables; botón Confirmar (deshabilitado hasta allReviewed).
  - CONFIRMED: BalanceCard + botón pago + ValueSummary + AuditTimeline; MovementsSection; probar pago con cada método (PAGO_MOVIL_BS, TRANSFERENCIA_BS, EFECTIVO_USD, BINANCE_USDT, OTRO), anular pago, pronto pago.
  - CANCELLED: BalanceCard + ValueSummary + AuditTimeline, sin acciones.
- Probar flujos: confirmar y pagar (contado), revertir lote, sugerencias de precio.

### Archivos

**Editar:** `src/routes/(app)/purchases/[id]/+page.svelte`, `PurchaseOrderDetailHeader`, `PurchaseOrderReviewReadyView`, `PurchaseOrderPaymentsDrawer`, `PurchaseOrderBalanceCard`, `PurchaseOrderValueSummary`, `PurchaseOrderDetailsSection`, `PurchaseOrderItemsTable`, `PurchaseOrderAuditTimeline`, `PurchaseOrderReviewProgressCard`, `PurchaseOrderDraftBanner`.

**Eliminar:** `PurchaseOrderStatusStepper.svelte`.

**Barrel:** `src/lib/components/purchases/detail/index.ts` — quitar export de `StatusStepper`.

**Reutilizar (sin crear nuevos):** `PurchaseOrderStatusBadge`, `PurchaseOrderDueBadge`, `AppBadge`, `SlideOver`, `ConfirmModal`, tokens `layout.css`.

### Riesgos / loose ends

- Verificar (grep) que `ReviewReadyView` y `StatusStepper` no se importan fuera del page/barrel antes de eliminar/reducir.
- Container queries Tailwind v4: el wrapper debe declarar `@container`; las variants `@<size>` se resuelven contra el ancestro `@container` más cercano. Definir tamaño nombrado `@container/main` si hay anidamiento conflictivo.
- `BalanceCard` solo en esta página (confirmar con grep; widget dashboard no lo usa).

## Required Specs

<!-- SPECS_START -->

- backup-infra-sec
- public-catalog-arch

<!-- SPECS_END -->

### Paso 6 — Extracción del aside con Context API ✅ HECHO

- Nuevo `src/lib/context/purchaseOrderDetail.ts` (convención `src/lib/context/`, Symbol key, getters como funciones): interface `PurchaseOrderDetailContext` con raw inputs (purchaseOrder, items, balance, dueStatus, auditHistory) + flags de estado (isDraft, isReadyForReview, isConfirmed, isCancelled, canManagePayments, zeroPriceCount) + bundle financiero (purchaseSummary, totalUnits, totalPurchase, totalSale, totalProfit, netTotalPurchase, netTotalProfit, settlementDiscountAmount, hasSettlementDiscount, needsSourceRate, srcSymbol, settlementDiscountLabel, totalPurchaseInBs, netTotalPurchaseInBs) — todo como getter functions para reactividad ante reassign de `$state`.
- Nuevo `PurchaseOrderAsidePanel.svelte` (única prop `onRegisterPayment`): consume context y decide la composición por estado con condicionales secuenciales (ReviewProgressCard si ready → BalanceCard si confirmed/cancelled → botón pago si canManagePayments → ValueSummary siempre → AuditTimeline si confirmed/cancelled). **Cero recálculo** — la página sigue siendo la fuente única.
- `+page.svelte`: página es ahora el **provider** (`setPurchaseOrderDetailContext` con arrow functions tras los `$derived`); las 4 ramas del aside (L521-631, ~110 líneas) reemplazadas por `<PurchaseOrderAsidePanel onRegisterPayment={...} />` (~2 líneas). Imports muertos eliminados (CirclePlus, BalanceCard, ReviewProgressCard, ValueSummary, AuditTimeline del page).
- Borrado `PurchaseOrderDetailsSection.svelte` (orphan: 0 refs en src/).
- Verificación: `pnpm check` (0 errors/warnings), prettier + eslint (0), `pnpm test:unit` (55 archivos, 730 tests), svelte-autofixer (0 issues).
