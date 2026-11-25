# sales (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Ventas ópticas: wizard con receta, items polimórficos (`PRODUCT | LENS_PAIR | TREATMENT | FREE_ITEM`), cobros multi-moneda con tasa BCV, máquina de estados por pieza (preparado para retiro), edición con reversión FIFO de inventario y cancelación con reembolso a caja. Lógica en `src/lib/server/sales/*Core` (patrón shell/core DT9); remotes son shells de auth + delegación (`remote/sales/lifecycle.remote.ts:1-15`).

## Scope

`components/sales/**`, `routes/(app)/sales/**`, `remote/sales/**`, `server/sales/**`, `queries/sales/**`, `schemas/sales*`, `schema/sales.ts`; lógica pura `shared/saleTotals*`, `saleItemCosts*`, `saleItemValues`, `saleItemGroups*`, `tickera*`, `ticketRate*`, `saleBalance*`.

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
- **Accesorios incluidos en el wizard** (`components/sales/step2/SaleStep2Items.svelte`): al agregar FRAME/SUNGLASSES, `getAccessoriesForProduct` devuelve `accessory: ProductWithRelations` y `addIncludedAccessoriesForItem` llama a `cacheProduct(accessoryRule.accessory)` antes de insertar la fila `kind: 'product'`. Sin hidratar `catalogCache`, `SaleItemInfo`, los checks de stock, el IVA de Step 3 y los `snapshot*` de `buildSaleItemsFromWizard` no resolvían el accesorio.
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

**Numeración** (sequence `sales_order_number_seq`, migración 0054; lógica en `queries/sales/writes.ts` → `createSale` + `bumpSaleOrderSequence`):

- **Automática**: sin `orderNumber`, la DB asigna `nextval` al insertar (alta y conversión quote→venta). Si el valor ya está ocupado (fila con número explícito que no subió la sequence), reintenta en un savepoint; en cada choque `resyncSaleOrderSequence` sube la sequence a `MAX(order_number)` (una racha de números ocupados no se recorre de a uno). Tras 5 intentos lanza "No se pudo asignar un número de orden automático. Intenta de nuevo." (nunca el 23505 crudo).
- **Manual (solo ADMIN)**: salto o backfill de ventas en papel. Se respeta tal cual; duplicado → `"El número de orden #N ya existe"` (unique `ix_sales_order_number`, rollback de toda la tx). Si N ≥ próximo automático, `setval(N)` en la misma tx → la siguiente automática es N+1. Si N es menor (backfill), la sequence **no se mueve** y el hueco queda libre para cargarlo a mano. La sequence **nunca baja** ni rellena huecos sola. Lo mismo aplica a la reasignación admin de `updateSaleCore`.
- **Preview no reservante**: `getSaleOrderNumberPreview()` (lee `last_value/is_called`, no consume) para el wizard (`sales/new/+page.server.ts`) y el modal de conversión (`getNextOrderNumberCommand`). Solo informativo.
- **UI** (`NewSaleForm`): el ADMIN ve el preview y se envía `orderNumber` solo si **escribió** en el campo (aunque coincida con el sugerido: una venta en papel #201 debe quedar #201); sin tocarlo, o tras "Usar último número generado", numera la sequence.
- `bumpSaleOrderSequence` serializa con `pg_advisory_xact_lock` (`lockSaleOrderSequence`; dos manuales en paralelo no dejan la sequence abajo). **Orden de locks:** primero el lock de la sequence, después filas de inventario. `createSaleCore` (número manual) y `updateSaleCore` (reasignación) lo toman al inicio de la tx, antes de revertir/consumir lotes (si no, deadlock). `setval`/`nextval` **no son transaccionales**: por eso el bump del manual va **después de la última escritura** de la tx (`createSale(..., { deferSequenceBump: true })` + `bumpSaleOrderSequence` al final de `createSaleCore`): un alta que falla por stock no deja la sequence adelantada. Un `nextval` consumido por una tx que hace rollback queda como hueco (nunca se duplica). `createSale` manual sin tx abre la suya (el advisory lock de tx necesita una tx).
- Reenviar el número actual de la venta en un update no es reasignación: no toma el lock, no escribe ni audita.
- Reasignación (`updateSaleCore`): reasignar su propio número no es duplicado; una carrera contra el unique devuelve el mismo mensaje "ya existe".
- ⚠️ Solo `db:migrate`: la sequence la crea la migración 0054 (no hay `pgSequence` en el schema), así que un `db:push` sobre una DB limpia falla por el default `nextval('sales_order_number_seq')`. Ejemplo operativo: va en #200, se corta la luz y hay 10 ventas en papel → al volver se escribe #211 a mano, las siguientes salen #212…, y luego se cargan #201–#210 a mano.

**Detalle layout (B+ §3-A)**: `.page` (`routes/(app)/sales/[id]/+page.svelte`) tope 1760 + `container-type: inline-size` (sin viewport queries para layout); hero (`SaleDetailHero.svelte`) con hijos directos `hl hc2 mon acts hcta` y `grid-template-areas` (700–1499 dos cols `290px`; ≥1500 tres zonas `1.05fr/1fr/330px` vía `@container`, cliente `hc2` a toda altura). Rail `360px ≥1060 / 420px ≥1500` (container).

**Detalle stock (B+ §3-C)**: `SaleStockDrawer.svelte` (SlideOver `w-full sm:w-[440px]`, reemplaza el uso de `SaleMovementsModal` — el archivo viejo se conserva) sobre los mismos `movements` del loader: subtítulo «N movimientos · efecto neto», tabla neto por producto (Producto·Salidas·Reversiones·Neto, 0 en gris), píldoras Todos/Salidas/Reversiones y grupos por operación (más reciente primero: «Edición · fecha · usuario» / «Creación de la venta» / «Cancelación», clave `referenceType+referenceId+usuario+minuto`). Lógica pura en `saleStock.ts` (+ `saleStock.spec.ts`).

**Detalle auditoría (B+ §3-D)**: `updateSale` anexa `changes.itemsDiff` (schema `SaleAuditDiff v1`, `schemas/sales.ts`) al evento «Venta actualizada», calculado puro post-tx (`server/sales/saleAuditDiff.ts:buildSaleAuditDiff`, tope 50 + `truncated`). Empareja por `id` cliente; `swap` = cambio de producto; hijos tratamiento re-creados sin id = `add`/`del`. Costos internos excluidos por allowlist (nunca en el diff). Eventos viejos sin diff ⇒ aviso en cursiva sin despliegue. Timeline fusiona `sale` + `sale_payment` (registrado/anulado; el void ahora audita `sale_payment` en `voidSalePayment.ts`) vía `queries/changeHistory.ts:getSaleAuditHistory(+Count)` + remote `history.remote.ts:getSaleAuditHistory` (limit/offset, «ver más»). UI: `SaleAuditTimeline` (3 recientes + «N cambios · Total ±» abre expandido), `SaleAuditHistoryDrawer` (filtros Todos/Ediciones/Estados), `SaleAuditEvent` (secciones ARTÍCULOS/DATOS/TOTALES, chip Total ±, MOTIVO destacado, estados como pills). Sin `title` nativos.

**Listado móvil (plan `sales-list-mobile`, contenedor <700px)**

- **Detección**: `ResizeObserver` sobre el contenedor de la página (`isNarrow = width < 700`, mismo patrón del detalle) en `+page.svelte`; la plantilla cambia entre `SaleListDesktop` / `SaleListMobile`. FAB y hojas montan **fuera del contenedor `@container`** (`fixed` + containment son incompatibles — `SaleMobileOverlays.svelte`).
- **Estado compartido**: `saleListContext.ts` (patrón wizardContext, Symbol key): el page publica getters + `handlers` + `mobileUi` (hojas móviles); escritorio y móvil consumen el MISMO contrato. Sin duplicar lógica de filtros/URL.
- **Shell móvil**: barra con selector de vista solo iconos (`SegmentedToggle iconOnly`), «Nueva venta» sale del header al FAB (toast «Vista guardada» al cambiar). KPIs en `Carousel` (232 px, tercera asoma, dots que siguen al scroll). Buscador+Filtros sticky (`SaleMobileControls`, sombra al pegarse via sentinel + IntersectionObserver). Pestañas y chips en `ScrollableRow` (una fila, máscara, re-alinea la activa).
- **Hoja de filtros** (`SaleMobileFilterSheet`): SlideOver bottom + `dragClose`; vendedor/fecha/mostrar solo/ordenar aplican AL INSTANTE (URL incluida); «Ver N ventas» solo cierra y muestra el `total` que ya devuelve `listSales` (sin remote extra).
- **Tarjeta**: `SaleCard` única con `density: 'comfortable' | 'compact'` — compact = fila densa (~88 px) con bloque de saldo fijo 116 px y flags en fila 1; comfortable = tarjeta rica de Cuadros. `SalesGridView` pasa `density` y `onMenu`.
- **Acciones ⋯**: gating único en `saleRowActions.ts` (+ spec) consumido por `SaleRowMenu` (popover escritorio, `size: sm|lg`) y `SaleRowActionsSheet` (hoja inferior móvil: header #·cliente + estado·saldo, filas 54 px, cancelar rojo; mismas navegaciones `?action=pay|status`; cancelar abre `CancelSaleModal` del listado). VIEWER solo «Ver detalle».
- **FAB**: `Fab` del kit, dorado, `hidden={!isNarrow || !canAct}`, contrae/oculta/reaparece con el scroll del `<main>`.
- **Pie móvil**: `SaleListFooter` variante `narrow` (resumen de selección plegable Total/Cobrado/Saldo + paginación ‹ X de Y › sin números, sin «por página»); al paginar hace scroll al top (`onPageChange(_, { scrollTop: true })`). `aria-live` de resultados ya existente.
- **Shell (todas las secciones, <lg)**: búsqueda global plegada en icono de lupa (`MobileGlobalSearch`, lógica compartida con escritorio); sin segunda fila de búsqueda. Ítems del menú lateral `min-h-11` (NavLink). Isotipo solo en xs (la barra completa no cabe).

**Detalle móvil (B+ §3-E, <700px contenedor)**: el sidebar global ya es overlay en viewport móvil (hamburguesa en `AppNavbar`, velo que cierra al tocar, `translate-x-full`↔abierto) — no se tocó para no romper otras rutas; nombre oculto <640 y búsqueda en segunda fila (patrón global existente). En la página: `+page.svelte` mide el contenedor `.page` con `ResizeObserver` (`isNarrow = width < 700`, el sidebar reacomoda el switch) y solo entonces monta `SaleDetailMobileBar` (fuera del contenedor: `fixed` + `container-type` son incompatibles) + `.mobile-spacer` de 96px. Hero 1 col: título 24, stepper compacto (etiqueta solo en paso actual, resto puntos), meta 2 col, dirección envuelve (`SaleDetailHeroCustomer`), dinero 2 col (Total+Bs | Saldo+Bs con divisor) + Desglose/Calcular full-width; barras decorativas ya ocultas <700. Acciones desktop (`hero-acts`/`hero-hcta`) ocultas <700; la barra fija lleva CTA dorado Cobrar/Imprimir + «Más» (hoja `SlideOver direction="bottom"`: estados con descripción, editar, imprimir ×3, calcular, pagos, historial, stock, separador, cancelar rojo — mismos guards que `SaleDetailHeroActions`). Artículos como tarjetas (`SaleItemsRow` flex: cabecera arriba, USD izq/Bs der abajo; subtítulo envuelve), header oculto, hijos sangría 36, fórmula full-row. Drawers ya `w-full sm:w-[...]`; calculadora `w-full sm:w-[580px]` + columnas compactas `sm:`; modales `ConfirmModal`/`Dialog` ya full-width (`max-w-[calc(100%-2rem)]`). Rail pagos/historial apilado <700 (`grid-cols-1 @min-[700px]:grid-cols-[1fr_1fr]`).

### Agrupación por persona (`sale-item-groups`)

- **Modelo**: `sale_item_groups` (`label` libre ≤60, nunca vinculado a `customers`; `position`) + `sale_item_group_members` (`quantity > 0`, PK compuesta). Metadato puro: borrado duro (cascade), **no toca dinero ni inventario**. Espejo en quotes.
- ⚠️ **Sin dividir líneas**: una línea ×N se reparte por unidades (`Σ members.quantity ≤ item.quantity`, resto = sin asignar). Tratamientos siguen a su cristal (`parentSaleItemId`) y nunca son miembros. Reglas y validación únicas en `shared/saleItemGroups.ts` (`validateItemGroups`, usado por Zod y servidor).
- ⚠️ **Fórmula principal** (`sales.primary_lens_item_id`, anclada al `LENS_PAIR`, no al grupo): solo ese cristal crea/reemplaza la `isCurrent` del cliente (`server/sales/primaryPrescription.ts`). Sin principal no se crea/pisa ninguna receta ni se parchean DP/NP. Default (`defaultPrimaryLens`): 1 cristal y sin nombres. Cambiar principal, cliente o graduación crea nueva `isCurrent` (nunca muta la del cliente anterior); desmarcar o cambiar cliente limpia `sale_items.prescription_id` sin borrar historial. `getSalePrescription` filtra `prescriptions.customerId = sales.customerId` y restringe al principal cuando existe.
- ⚠️ **Concurrencia y orden FK**: `saveSaleItemGroups`, `updateSale` y `cancelSale` toman `FOR UPDATE` sobre `sales` (`lockSaleForGroups`) y re-leen el estado bloqueado dentro de la tx. Lecturas (`getSaleItemsWithDetails`/`getQuoteItemsWithDetails`) y escrituras ordenan padres antes que tratamientos hijos para evitar violaciones de FK autoreferenciada (`23503`).
- **IDs y accesorios**: create usa el id cliente; `updateSale` reemplaza ítems y remapea grupos/principal con `idMap` (`groups` ausente = conserva remapeados; `[]` = quita todos). En wizard, accesorios auto-incluidos siguen a su montura (`followIncludedAccessories`).
- **Orden, códigos y UI** (`components/sales/groups/`): orden derivado (`orderItemsByGroups`/`orderLinesByGroups`: montura → cristal+tratamientos → accesorios; sin imprimir nombres en ticket/PDF). Códigos `groupCode` derivados de número+posición (`230-1`, `P-0055-1`); reorganizar un documento ya guardado con grupos exige confirmación (`ReorganizeGroupsConfirm`). Entrypoints: `ItemPersonChip`, `PersonsDrawer` (draft local en wizard), `PersonsView` (detalle sin dinero) y `GroupsOrganizer`.

## Patrones locales

- Remote `saveSaleItemGroups({saleId, groups, primaryLensItemId})` (`remote/sales/groups.remote.ts` → `server/sales/saveSaleItemGroups.ts`): guardado solo-grupos con ids reales; `requireRole(ADMIN, MANAGER, SELLER)` + `canManageSaleByOwner`; todo estado salvo CANCELLED (incluye COMPLETED); lock `FOR UPDATE` en `sales`; auditoría «Agrupación por persona actualizada». `createSale`/`updateSale` aceptan `groups` y `primaryLensItemId` (ids cliente).

- **Shell/core (DT9)**: lógica = `<acción>Core(input, ctx)` en `server/sales/<acción>.ts` con `ActionContext` explícito; remote solo `requireRole` + delega. Es el patrón de referencia para otros dominios.
- **Int specs co-ubicados** junto al core (`server/sales/*.int.spec.ts`, Postgres real/Testcontainers).
- Lógica pura de negocio en `src/lib/shared/` (ver Scope). Helper compartido de snapshot costs con quotes: `resolveLensSnapshotCosts` (consolidado; ya no hay duplicado).
- Queries `queries/sales/` divididas (DT1): `reads|writes|items|payments|shared|types` — algunas aún usan `db` fijo.
- Gate de tamaño de archivo (`scripts/check-file-size.sh`) activo en este dominio; partes descompuestas por plan `dt1-t2-sales`.

## Testing

- Cores: `*.int.spec.ts` co-ubicados (lifecycle create/cancel/setStatus/update, voids con recálculo + quién/motivo, FIFO cancel/update, `saleRevertOrigin` — edición escribe `EDIT_REVERT` con motivo, cancelación `CANCEL_REVERT`, free-item enrichment; `updateSaleAuditDiff` — el `itemsDiff` v1 se guarda sin alterar totales/inventario, header-only y no-op, el void audita `sale_payment`).
- Unit del diff: `server/sales/saleAuditDiff.spec.ts` (add/del/swap/mod por campo, fórmula OD/OI, montaje, tratamiento hijo sin id, descuento global, Cashea, totales numéricos, costos excluidos, tope 50+`truncated`).
- Schemas: `schemas/sales.spec.ts` (incl. `VoidPaymentSchema`: motivo obligatorio 1–500). Unit puros espejados en `components/sales/**` (pricing, taxBreakdown, paymentForm*, editSale*, wizard*, etc.).
- Componentes (`project=client`, browser): `editSale/EditSaleLensEditor.svelte.spec.ts` — el «Hecho» del editor de cristal debe entregar al `onApply` lo editado en el draft (precio, graduación, enlace al catálogo).
- Listado: `shared/saleBalance.spec.ts`, `components/sales/listParams.spec.ts`, `components/sales/saleDisplay.spec.ts`; gating del ⋯ compartido: `components/sales/saleRowActions.spec.ts`; a nivel DB `queries/sales/list.int.spec.ts` (stats/facetas/selección/saldo/flags) y `queries/userPreferences.int.spec.ts` (ambos `project=integration`, requieren Docker).
- E2E de dinero: `e2e/sale-payment.test.ts`, `e2e/quote-to-sale.test.ts`.

**Componentes compartidos con quotes (plan `quotes-redesign`)**

- El CSS del hero navy se extrajo a `$lib/components/layout/heroNavy.css` (grid por áreas `hl/hc2/mon/acts/hcta`, franjas, `.hero-btn`, container queries `<700/≥700/≥1500`); `SaleDetailHero.svelte` y `QuoteDetailHero.svelte` lo importan — **no duplicar el CSS**. `SaleDetailHeroActions` ya no define `.hero-btn` (vive en el CSS compartido). Registro en `docs/agents/shared.md`.
- `SaleDetailHeroCustomer` acepta `emptyState?: Snippet` opcional: ventas siguen con el fallback "—"; el detalle de presupuesto sin cliente pasa su propio estado vacío con "Asignar cliente ahora".
- `SaleItemsTable` acepta `groups?: DisplayGroup[]`, `headerBadge?: Snippet` y `sectionTitle?` opcionales: por defecto calcula sus grupos igual que siempre (cero regresión); quotes pasa los grupos de `quoteItemsAdapter.ts` y el badge "Solo lectura · tal como se presupuestó".
- `EditSaleModal` acepta `quote?`/`quoteItems?` (modo presupuesto vía `quoteEditAdapter.ts`); en modo venta (default) el comportamiento es idéntico. `EditSaleModalHeader` tiene `title`/`numberLabel`/`entityNoun` opcionales; `EditSaleMetaBar` tiene `showValidUntil` (**solo quotes**: ventas no muestran "Válido hasta"); `EditSaleFooter` tiene `requireReason`/`saveTooltipOverride` (quotes no pide motivo).
- `SaleListHeader`, `SaleFilterBar`, `SaleStatusTabs`, `SaleFilterChips`, `SaleListFooter` se generalizaron con props opcionales para el listado de presupuestos; los call sites de ventas pasan los mismos valores de siempre (`onCreate` navega con `resolve()`).
- Listado móvil compartido con presupuestos (props opcionales, defaults = ventas): `SaleMobileFilterSheet` (`sortOptions`, `toggleOptions`, `resultNounOne/Many`, `idPrefix`; `sort`/`onSortChange` tipados `string`, el overlay de ventas castea a `SaleListSort`), `SaleMobileControls` (`placeholder`, `ariaLabel`, `inputId`), `SaleFilterBar` (`toggleOptions`).
- **Vista Lista/Cuadros = una sola preferencia para ventas y presupuestos:** `LIST_VIEW_PREFERENCE_KEY = 'sales.view'` en `listParams.ts` (lo leen ambos loaders) y `persistListView()` en `listViewPreference.ts` (+ spec; toast con id fijo y reintento silencioso). No crear otra llave por listado.
- Historial: `AuditEventsDrawer.svelte` es el shell presentacional (filtros, eventos, «Ver más» opcional); `SaleAuditHistoryDrawer` solo carga/clasifica/pagina y lo usa, igual que `QuoteAuditHistoryDrawer`. `AuditEvent` ganó `note` (línea neutra bajo el autor) y `buildAuditEvent` (factory exportada); `auditDiffRows` usa las etiquetas de `quote` para eventos de presupuesto. `buildSaleAuditDiff` acepta `dateLabel` (quotes: «Fecha»).
- `toSaleTotalsLine` y `resolveLensSnapshotCosts` viven en `$lib/shared/` (fuente única con quotes); ya no hay duplicado en `remote/sales/helpers.ts`.
- `removeEditableItem` (drawer de edición): quitar un ítem SIN id borraba también todos los ítems de nivel superior (`parentSaleItemId` undefined === `item.id` undefined); ahora solo quita el placeholder. Specs: `editSale/{editSaleModalHelpers,submitEditSale}.spec.ts`.
- `CustomerLookupInput` en modo `create` sincroniza `newCustomer` también al escribir la cédula (antes solo nombre/apellido): el comando recibía `newCustomer` sin `idNumber` si la cédula se llenaba al final.

**D12 / D13 (decisiones del mockup de quotes aplicadas también a ventas)**

- **D12:** la X de cerrar sobre header navy (`EditSaleModalHeader`) usa `bg-white/15 text-white ring-1 ring-white/30 hover:bg-white/25`; nunca el gris tenue anterior. Regla repo-wide en `.github/instructions/design-ui.instructions.md`.
- **D13:** en `SaleDetailHero.svelte` (`.money-tools`), "Desglose" (con `List` + chevron rotativo) y "Calcular factura" (con `Calculator`) son botones visibles: `inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-white/20`. Se conservan el `TriggerTooltip` de "Calcular factura" y la rotación del chevron. El detalle de presupuesto usa el mismo estilo para su "Desglose".

## Known gaps / tech debt

- 🟡 `updateSaleFifo.int.spec.ts` existe pero **su fuente `updateSaleFifo.ts` aún no** — spec avanzado del plan; extraer la lógica FIFO de update antes de confiar en el spec.
- 🟡 **Seguimiento de laboratorio por persona (plan futuro):** compra del cristal, montaje y entrega por grupo/persona. Fuera del alcance de `sale-item-groups`; los grupos ya dan el emparejamiento montura↔cristal sobre el que se apoyaría.
- ~~🟡 `getNextOrderNumber` sigue siendo MAX+1 dentro de la tx~~ — **Resuelto** (PR fix/sessions-dt26-sale-sequence): sequence `sales_order_number_seq` + número manual con `setval` solo hacia arriba (ver Numeración). Spec: `server/sales/saleOrderNumber.int.spec.ts`.
- 🟡 `PaymentForm` family: el state factory vive en `components/sales/payments/` aunque la UI adapter está en `components/payments/` (herencia del factory transversal) — mover al unificar pagos (plan pr5).
- 🟡 Fecha-verdad (composición Caracas) pendiente para: `sale_payments.paymentDate`, `purchase_orders.orderDate`, `quotes.quoteDate`, `prescriptions.prescriptionDate` .

## Planes completados

- **2026-11 · sale-item-groups** — Agrupar ítems por persona en ventas y presupuestos (reparto por unidades sin dividir líneas, códigos `N-1`, orden por persona, fórmula principal anclada al cristal y confirmación al reorganizar) (#232)
- **2026-11 · sales-list-mobile** — Listado /sales en móvil + búsqueda global plegable en el shell (kit móvil compartido, mockup ventas-listado-mobile) (#228)
- **2026-11 · detalle-venta-bplus** — Detalle de venta B+: pantallas grandes, pagos con quién+motivo, stock drawer, historial con diff y móvil (#225)
- **2026-11 · dt1-t2-sales** — sales/[id] 792→~300 (luego 504 con B+) + 6 secciones detail/ + saleDetail.ts con spec (#122)
- **2026-11 · redesign-sale-detail-view** — Rediseño total de /sales/[id] según mockup B: hero navy, artículos, pagos, calculadora de factura, tasa Modo A/B (#216)
- **2026-11 · rework-editar-venta-ui-ux** — Editor de venta rehacedo: cristal con errores inline, rango óptico warning-confirmable, documentEditor compartido listo para quotes (#193, #208, #209)
- **2026-11 · sale-createdat-truth** — sales.sale_date eliminada: created_at única fecha-verdad con composeBusinessTimestamp (día form + hora Caracas); resto de módulos queda como DT22
- **2026-11 · sale-subtotal-fix** — subtotal = BI+Exento pre-impuesto en ventas y quotes; total intacto; helper computeSaleTotals + backfill 0042
- **2026-11 · sales-list-redesign** — Listado /sales rediseñado: KPIs globales, vistas Lista/Cuadros, pestañas facetadas, ?action= (patrón agnóstico), user_preferences por perfil
- **2026-11 · tickera-rate-freeze** — Tasa BCV congelada por venta (snapshot_bcv_rate + resolveTicketRate): reimpresiones deterministas (#966ed371)
- **2026-11 · quotes-redesign** — Presupuestos rediseñados con componentes de ventas (lista, detalle, edición, conversión con preview); numeración por sequence y duplicar desde cualquier estado (#229)
