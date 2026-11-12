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
- Void = soft-delete con `voidedAt` (idempotente); encontrar el pago exige que pertenezca a la venta y esté sin void (cross-sale void rechazado).
- ⚠️ Editar items reduciendo `total < paidAmount − 0.01` se **rechaza** (redirigir a cancelar + recrear) — `updateSale.ts:133-139`.

**Items / modificadores**

- `LENS_PAIR` exige receta al momento (snapshot OD/OS en `sale_items`); `TREATMENT` es hijo con `parentSaleItemId` y debe compartir proveedor con el cristal — validado en create (`createSale.ts:43-46`) y edit (`updateSale.ts:104-109`).
- Medidas de montaje snapshot en `sale_items` (`dp`, `np_right`, `np_left`, opcionales): escritas en create (`wizardSubmission.ts` `buildSaleItemsFromWizard`) y edit (`editSaleLensAdapter.ts`); migración `0048` backfilla desde la receta vinculada. Ausentes → "—" en `LensRxPanel` y aviso ámbar solo si falta ALT/DNP en progresivos/bifocales (`missingMountingMeasures`); DP nunca es obligatorio. La conversión cotización→venta aún no copia medidas (mismo hueco que ALT).
- `FREE_ITEM` no consume FIFO y tiene fila 1:1 `sale_item_free_details` con `enrichment_status PENDING→ENRICHED` (`server/sales/enrichFreeItem.ts:15-62`).
- Costos snapshot post-venta solo del módulo lens: `updateItemCosts` recalcula `snapshotCostTotal/Unit` (`updateItemCosts.ts:21-37`).
- Edición de items = **reseteo completo del inventario** (revert con `CANCEL_REVERT` + re-consumo) en una sola tx; items viejos soft-delete en cascada (`updateSale.ts:36-37,178-308`). Falla si COMPLETED (`:51-53`) o no-ADMIN si IN_PROGRESS/READY (`:55-64`).

**Dinero (subtotal / total / tasas)**

- Semántica de subtotal (`docs/specs/sale-subtotal-semantics.md`): la suma cruda de líneas con IVA incluido (post descuentos de línea). Cobrado: `total = max(0, rawSubtotal − descuento global)`. Helper puro `computeSaleTotals` (`shared/saleTotals.ts:37-72`; impuestos: PRODUCT gravable por default, resto exento).
- ⚠️ Tasa BCV congelada `snapshotBcvRate` (NULL = pre-feature): se captura viva al submit de create/edit; si la API cae queda NULL y tickera cae a tasa viva vía `resolveTicketRate` (`createSale.ts:59-61`, `docs/plans/tickera-rate-freeze.md`). Cambiar la fecha NO cambia la tasa (pertenece al evento).
- Comparaciones de "¿pagado?" usan tolerancia 0.01.

**created_at como fecha-verdad** (`docs/plans/sale-createdat-truth.md`)

- `sale_date` eliminada: `created_at` es la única fecha (día del form + hora del submit, compuesta en Caracas UTC-4 por `composeBusinessTimestamp`). El alias `saleDate` del schema lo mapea el server (`createSale.ts:108-110`, `updateSale.ts:293-294`). No reintroducir `saleDate` como columna.

**Inventario**

- PRODUCT: FIFO completo (lotes + movimiento `SALE_OUT` + caché stock), con `sale_items.lotId` = lote primario (`queries/fifoConsumption.ts:56-120`, `schema/sales.ts:152-153`). Lente STOCK/no-product: solo decremento de contador.
- Cancel/edición: `returnToLot` por cada `SALE_OUT` + movimiento `CANCEL_REVERT` (nunca hard-delete de movimientos) — `cancelSale.ts:46-113`.

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

## Patrones locales

- **Shell/core (DT9)**: lógica = `<acción>Core(input, ctx)` en `server/sales/<acción>.ts` con `ActionContext` explícito; remote solo `requireRole` + delega. Es el patrón de referencia para otros dominios.
- **Int specs co-ubicados** junto al core (`server/sales/*.int.spec.ts`, Postgres real/Testcontainers).
- Lógica pura de negocio en `src/lib/shared/` (ver Scope). Helper compartido de snapshot costs con quotes: `resolveLensSnapshotCosts` (⚠️ duplicado, ver deuda).
- Queries `queries/sales/` divididas (DT1): `reads|writes|items|payments|shared|types` — algunas aún usan `db` fijo.
- Gate de tamaño de archivo (`scripts/check-file-size.sh`) activo en este dominio; partes descompuestas por plan `dt1-t2-sales`.

## Testing

- Cores: `*.int.spec.ts` co-ubicados (lifecycle create/cancel/setStatus/update, voids con recálculo, FIFO cancel/update, free-item enrichment).
- Schemas: `schemas/sales.spec.ts`. Unit puros espejados en `components/sales/**` (pricing, taxBreakdown, paymentForm*, editSale*, wizard*, etc.).
- Listado: `shared/saleBalance.spec.ts`, `components/sales/listParams.spec.ts`, `components/sales/saleDisplay.spec.ts`; a nivel DB `queries/sales/list.int.spec.ts` (stats/facetas/selección/saldo/flags) y `queries/userPreferences.int.spec.ts` (ambos `project=integration`, requieren Docker).
- E2E de dinero: `e2e/sale-payment.test.ts`, `e2e/quote-to-sale.test.ts`.

## Known gaps / tech debt

- 🟠 `routes/(app)/sales/[id]/+page.svelte` (792 líneas) — descomposición en curso (`docs/plans/dt1-t2-sales.md`, activo).
- 🟠 Plan `docs/plans/pr5-payment-factory.md` activo: specs pendientes de `paymentFormModel` y fns derivadas.
- 🟡 `updateSaleFifo.int.spec.ts` existe pero **su fuente `updateSaleFifo.ts` aún no** — spec avanzado del plan; extraer la lógica FIFO de update antes de confiar en el spec.
- 🟡 `PaymentForm` family: el state factory vive en `components/sales/payments/` aunque la UI adapter está en `components/payments/` (herencia del factory transversal) — mover al unificar pagos (plan pr5).
- 🟡 `resolveLensSnapshotCosts` duplicado (`remote/quotes/helpers.ts` vs `remote/sales/helpers.ts:35-58`) — consolidar en `src/lib/shared/`.
- 🟡 Fecha-verdad (composición Caracas) pendiente para: `sale_payments.paymentDate`, `purchase_orders.orderDate`, `quotes.quoteDate`, `prescriptions.prescriptionDate` (`docs/plans/sale-createdat-truth.md:18`).
- 🟡 Flujo de edición de venta por rehacer (validación óptica + advertencias): plan `docs/plans/rework-editar-venta-ui-ux.md` (activo).
