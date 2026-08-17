# Optikt App — Plan de Evolución

> Análisis de deuda técnica, features pendientes y features propuestas.
> Actualizado: 2026-08-16.

---

## Prioridades

| Símbolo | Significado               |
| ------- | ------------------------- |
| 🔴      | Crítico — atacar ya       |
| 🟡      | Alto — en este trimestre  |
| 🟢      | Medio — cuando haya banda |
| ⚪      | Bajo — nice to have       |

---

## 1. Deuda Técnica

### DT1 · Archivos gigantes sin descomponer 🔴

**Problema:** 39 archivos >500 líneas. Top 5: `LensCatalogForm.svelte` (1473), `EditSaleModal.svelte` (1381), `sales.remote.ts` (1273), `purchaseOrders.remote.ts` (1240), `inventory/count/[id]/+page.svelte` (1139). El plan `componentize-purchase-detail` ya bajó purchases/[id] de 2221→629 líneas como prueba de concepto.

**Riesgo de no hacerlo:** Mantenibilidad nula. Cada fix toca un monolito. Onboarding imposible. Regresiones frecuentes. El patrón de extracción ya está validado — solo falta aplicarlo al resto.

**Contras:** Refactor puro, cero feature nueva. Riesgo de introducir bugs si no hay tests. Las remote functions son más difíciles de split sin romper imports.

**Dificultad:** Media (3-5 días por archivo grande). **Solución:** Mismo patrón que `purchase-detail`: extraer sub-componentes y helpers puros. Priorizar los 5 más grandes.

---

### ✅ DT2 · Errores silenciados (COMPLETADO — 2026-08-10)

**Qué se hizo:** Auditar los 182 catch blocks del codebase. Resultado: solo **1** error era verdaderamente silencioso — `exchangeRates/service.ts:170` (fallo de API absorbido en `cache.lastError` sin señal visible). Todo lo demás ya tenía toast, `return {success:false}` o supresión intencional de cleanup.

**Cambios:**

- `logger.error('Error obteniendo tasas de cambio de la API', error)` agregado en el catch de `refreshExchangeRates`.
- Bonus: el error se propaga al UI — `refreshExchangeRatesCommand` ahora lanza si `snapshot.lastError` está seteado (antes el UI mostraba "Tasas actualizadas" con la API caída). Mensaje amigable al usuario ("No se pudo conectar con el proveedor de tasas"), detalle técnico en logs.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, 741/741 tests ✓.

---

### ✅ DT3 · Validación Zod subutilizada (COMPLETADO — 2026-08-10)

**Qué se hizo:** Auditoría completa de validación en la capa remote. **El problema original estaba mal diagnosticado.**

**Hallazgo real:** 143 de 152 remote functions (94.1%) ya pasan un Zod schema como primer argumento a `command()`/`query()`/`form()` — SvelteKit valida internamente, por eso hay solo 1 `.safeParse()` manual (en un helper de finanzas, no en validación primaria). Contar `.safeParse()` es irrelevante: el `.parse()` ocurre dentro de SvelteKit. Las 9 remote functions sin schema reciben **cero input** del cliente — correcto tal cual.

**Cambios:**

- Eliminados 5 schemas muertos (exportados pero nunca usados por ninguna remote function): `ExpenseIdSchema`, `ListInventoryLotsSchema` (+ sus tests), `AddPurchaseOrderItemSchema`, `UpdateSaleStatusSchema`, `EnrichFreeQuoteItemSchema` (+ su type).
- 91.5% → 100% de schemas en uso.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, tests de schemas ✓.

**Lo que NO se hizo (scope real, ver DT10):** validaciones de **negocio** inline (ifs en handlers como "no borrar producto con ventas") no están centralizadas en Zod. Ese es el trabajo grande y va aparte.

---

### DT10 · Validación de negocio en Zod refinements 🟡

**Problema:** Las reglas de negocio (no borrar producto con ventas, no cerrar venta sin pago completo, no anular pago conciliado, etc.) viven como ifs inline dentro de los handlers de las remote functions. Los schemas Zod validan forma (shape), no reglas de negocio.

**Por qué importa:** La misma regla se duplica entre front (deshabilitar botones) y back (ifs en handlers). Cuando cambia una regla hay que cazarla en 2+ lugares. Los schemas son el contrato — deberían poder expresar "este input es inválido en el contexto actual" con `.superRefine()`.

**Contras:** Algunas reglas dependen del estado de la DB (consultas), no solo del input — esas no caben en un schema puro; requieren validación en el handler de todos modos. Riesgo de romper flujos si un refinement es más estricto que el if actual.

**Dificultad:** Media (5 días). **Solución:** (a) Inventariar las reglas de negocio inline por dominio (sales, purchaseOrders, inventory, customers). (b) Clasificar: input-only (→ `.superRefine()` en el schema) vs state-dependent (→ helper compartido server-side). (c) Mover las input-only a los schemas con mensajes en español. (d) Extraer las state-dependent a helpers reutilizables entre remote functions. ~5 días.

**Estado:** Plan activo. Sin empezar.

---

### ✅ DT11 · Dead code: componentes sin usar (COMPLETADO — 2026-08-17)

**Qué se hizo:** Eliminados 5 componentes con cero imports (verificado con rg): `CustomerViewModal`, `PrescriptionViewModal`, `PrescriptionFormModal`, `PrescriptionsTable` y `PurchaseCurrencyInput` (este último huérfano total, sin barrel export). Limpiados los exports de `customers/index.ts` y `prescriptions/index.ts`. `SupplierViewModal` NO se tocó — sí se usa en `SuppliersTable.svelte`. **-1410 líneas.**

**Verificación:** `pnpm check` 0 errores, `pnpm lint` limpio, 755/755 tests.

---

### DT12 · DataTable y DataGrid duplicados 🟢

**Problema:** Dos implementaciones de tabla con APIs distintas en `src/lib/components/ui/` (`DataTable.svelte` y `DataGrid.svelte`) — misma función, contratos incompatibles.

**Riesgo de no hacerlo:** Dos fuentes de bugs de UI. Migrar entre componentes requiere reescritura, no cambio de import.

**Dificultad:** Media (2 días). **Solución:** Inventariar usos de cada uno, elegir el dominante, migrar los usos del otro y eliminar el perdedor.

---

### DT13 · Enums y labels de moneda duplicados 🟡

**Problema (auditoría 2026-08-17):** `PurchaseSourceCurrency` vs `CurrencyCode` — dos enums con sets solapados (`USDT`, `VES`). La duplicación real viva es menor de lo que decía el análisis anterior:

- **Vivo:** `getSettlementCurrencySymbol` (purchaseOrderCurrencies.ts, 12 consumidores) duplica `CURRENCY_SYMBOLS` (currencyTypes.ts). `getSourceCurrencySymbol` (13 consumidores) es el canónico de PurchaseSourceCurrency.
- **Muerto (cero consumidores):** `PURCHASE_SOURCE_CURRENCY_LABELS`, `PURCHASE_SOURCE_CURRENCY_SYMBOLS`, `getPurchaseSourceCurrencyLabel`, `getPurchaseSourceCurrencySymbol`, `isAltSourceCurrency` (purchaseTypes.ts) + `getSettlementCurrencyLabel`, `isAltDisplayCurrency` (purchaseOrderCurrencies.ts).
- **4ª implementación hermana:** `EXPENSE_CURRENCY_LABELS/SYMBOLS` (cashTypes.ts) — enum propio, se trata como **DT16**.

**Riesgo:** Cambiar un label requiere 2-3 archivos; helpers muertos confunden.

**Dificultad:** Media (1 día). **Solución:** (a) Borrar los 7 helpers muertos. (b) Unificar símbolos: nuevo `getCurrencySymbol` en `currencyTypes.ts` (usa `CURRENCY_SYMBOLS`), migrar los 12 consumidores — tablas idénticas, cero cambio visual (verificado por script). (c) Mantener `getSourceCurrencySymbol` como único helper de PurchaseSourceCurrency. Core sano intacto: `SOURCE_TO_CURRENCY_CODE`, `sourcePriceToUsdBcv`, `sourceCurrencyRequiresRateToVes`, `getCurrencyLabel`.

**Estado:** Plan activo. Plan detallado: `docs/plans/currency-consolidation.md`.

---

### DT16 · Enums de moneda de gastos 🟢

**Problema:** `cashTypes.ts` define `EXPENSE_CURRENCIES`/`EXPENSE_CURRENCY_LABELS`/`EXPENSE_CURRENCY_SYMBOLS` (enum propio `'USD'|'VES'|'USDT'|'EUR'`) — una 4ª implementación de moneda que se solapa con `CurrencyCode` y `PurchaseSourceCurrency`. Detección en auditoría DT13 (2026-08-17); fuera de scope de DT13.

**Por qué importa:** 4 fuentes de verdad de "qué es una moneda y cómo se muestra". Cambiar un símbolo de gastos requiere tocar un archivo distinto al resto.

**Contras:** Refactor de gastos UI (caja de gastos, pagos) — el enum local no es `CurrencyCode` y las filas persisten strings.

**Dificultad:** Media (2 días). **Solución:** (a) Mapear `ExpenseCurrency` → `CurrencyCode` (`USD`→`USD_BCV`, `EUR`→`EUR_BCV`, `VES`→`VES`, `USDT`→`USDT`) o unificar el enum directamente. (b) Reemplazar labels/symbols por `getCurrencyLabel`/`getCurrencySymbol`. (c) Verificar display de caja de gastos y pagos de gastos.

**Estado:** Plan activo. Sin empezar.

---

### DT14 · Wizard de compras carga todo en SSR 🟡

**Problema:** El `load` de `/purchases/new` trae **todos** los productos (`getAllProductsWithRelations({ limit: 500 })`) y lentes sin filtrar por proveedor. El proveedor se elige en Step 1, pero los datos se cargan antes de saber cuál es. Payload SSR innecesario; la búsqueda cliente-side escanea registros que nunca se usarán.

**Riesgo:** Memoria y tiempo SSR desperdiciados. Escala mal con catálogo grande.

**Dificultad:** Baja-Media (1-3 días). **Solución:** Opción A (primero): al validar Step 1, fetchear productos del proveedor vía `/api/products?supplierId=X`; el `load` SSR deja de traer productos/lentes. Opción B (ideal): search server-side `/api/products/search?supplierId=X&q=texto` con el combobox consultando en tiempo real. **Archivos:** `src/routes/(app)/purchases/new/+page.server.ts`, `+page.svelte`, `src/lib/components/purchases/step2/PurchaseOrderStep2.svelte`.

---

### ✅ DT15 · Altura por ojo ausente en presupuestos (COMPLETADO — 2026-08-17)

**Qué se hizo:** `quote_items` ahora captura y persiste la altura por ojo:

- Migración **0040** idempotente: `od_altura`/`os_altura` en `quote_items`.
- `QuoteItemSchema`: `AlturaSchema.optional()` por ojo (10-40mm).
- `buildQuoteItemsFromWizard` mapea `lensPair.od/oi.altura`.
- `quotes.remote` persiste en el insert **y en la conversión presupuesto→venta** (antes la venta creada desde quote perdía la altura — mismo bug por otra puerta).
- El wizard de presupuesto ya capturaba la altura (reusa componentes de venta) — sin cambios de UI.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` limpio, 758/758 tests. Migración aplicada + idempotente en local.

---

### ✅ Resueltos por auditoría de TECH_DEBT.md (2026-08-16)

El archivo `TECH_DEBT.md` fue auditado, consolidado y eliminado. De sus 8 items, 3 ya estaban resueltos en el código:

- **Prescripción global para operaciones con múltiples cristales** — resuelto: la Rx por ojo (od/os sphere, cylinder, axis, addition) ya vive en `sale_items` (`schema/sales.ts`) y `quote_items` (`schema/quotes.ts`).
- **`build/` en el repo** — ya ignorado: `/build` en `.gitignore` (línea 10), cero archivos tracked.
- **Conversión dual en slide-over de pagos de ventas** — ya implementado: `PaymentForm.svelte:853` muestra `≈ X USD BCV` con la tasa del día para pagos en moneda distinta.

---

### ✅ DT4 · 162 console.log/error en producción (COMPLETADO — 2026-08-10)

**Qué se hizo:** Cero `console.*` en código de producción (solo dentro del logger). Se creó un wrapper compartido y se eliminó el ruido.

**Cambios:**

- Nuevo `src/lib/utils/logger.ts` — wrapper `debug/info/warn/error` con formato `[level] message`, contexto opcional. `debug` solo en dev (`import.meta.env?.DEV`). Cero dependencias.
- **139 `console.error`/`warn` redundantes eliminados** en 71 componentes/páginas + 20 en remote functions — catch blocks que ya mostraban toast o retornaban `{success:false}`.
- **16 intencionales → `logger.*`**: hooks.server (`handleError`), exchangeRates poller, notifications service, `reportClientError`, form unbound-issues (`warn`), defaults de PDF shutdown.
- **7 paths silenciosos → `logger.error`** (única señal del fallo, sin toast): refreshStats en products/sales/quotes, CommandSearch, NewQuoteForm, NewSaleForm, LensCatalogForm.
- DEBUG logs de `pdf.ts` eliminados.
- Nota: `pdf.ts` usa import relativo (`../utils/logger`) porque su fixture de test corre en node plano sin alias `$lib`; el logger evita `import.meta.env` directo por la misma razón.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, 741/741 tests ✓. 83 archivos, −183/+50 líneas.

---

### ✅ DT5 · Patrón de error duplicado (COMPLETADO — 2026-08-10)

**Qué se hizo:** El diagnóstico original ("12+ veces en cada archivo remote") estaba desactualizado — la migración a `getErrorMessage()` ya había ocurrido: 63 archivos lo usaban. Solo quedaban **4 rezagados con 16 instancias** del patrón inline `e instanceof Error ? e.message : '...'`.

**Cambios:**

- `purchaseOrders.remote.ts`: 12 patrones → `getErrorMessage(e, '<mensaje>')`.
- `exchangeRates.svelte.ts`: 2 patrones (store).
- `LensCatalogForm.svelte` y `ProductForm.svelte`: 1 patrón cada uno (incluida la expresión multi-línea de ProductForm).
- Zero patrones inline restantes en `src/` (solo la implementación de `getErrorMessage` y el serializador de hooks usan `instanceof Error`, correctamente).

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa completo (prettier + eslint), 738/738 tests ✓.

---

### DT6 · Soft-delete inconsistente 🟡

**Problema:** 13 tablas con `deletedAt` timestamp, 2 con `voidedAt` (sale_payments, cash_expenses), 8+ sin ningún mecanismo (settings, inventory_lots, notifications, etc.). `lens_technologies` y `supplier_treatments` usan `isActive` boolean. Sin estándar.

**Riesgo de no hacerlo:** Comportamiento impredecible al "borrar". Un DELETE en una tabla sin soft-delete pierde datos para siempre. La semántica de `voidedAt` vs `deletedAt` es ambigua.

**Contras:** Migración DB necesaria. Posible breaking change si queries no filtran `deletedAt`.

**Dificultad:** Media. **Solución:** (a) Definir estándar: todo usa `deletedAt` timestamp (null = activo). (b) Migración para tablas sin él. (c) `voidedAt` → renombrar a `deletedAt` para consistencia (o mantener si la semántica es distinta). (d) Actualizar todos los queries afectados.

---

### DT7 · Dos stacks de PDF redundantes 🟢

**Problema:** `puppeteer-core` + `@sparticuz/chromium` + `@pdfslick/core` + `pdfjs-dist`. Cuatro dependencias de PDF. Probablemente `@pdfslick/core` y `pdfjs-dist` son para visualización client-side y `puppeteer` para generación server-side, pero no está documentado.

**Riesgo de no hacerlo:** Bundle más pesado. Dos fuentes de bugs. Actualizaciones de seguridad duplicadas.

**Contras:** Si ambos son necesarios (uno para generar, otro para mostrar), no hay nada que hacer.

**Dificultad:** Media. **Solución:** Auditar qué usa cada dependencia. Si hay solapamiento real, consolidar. Si no, documentar por qué ambas.

---

### DT8 · Dashboard sin gráficos 🟡

**Problema:** El dashboard (`/dashboard`) muestra 4 tarjetas numéricas (total clientes, ventas hoy, cotizaciones pendientes, stock bajo) + tablas. Sin tendencias visuales, sin comparativas temporales, sin breakdowns por producto/vendedor/marca.

**Riesgo de no hacerlo:** El dueño no ve la salud del negocio de un vistazo. Percepción de herramienta "básica" comparada con competidores. Decisiones sin datos.

**Contras:** Agregar librería de charts (`layercake`, `chart.js`) suma peso al bundle.

**Dificultad:** Baja. **Solución:** Agregar `layercake` (Svelte-native, más liviano) o `chart.js`. KPIs nuevos: revenue diario/semanal/mensual, top productos, top vendedores, profit margin trend, conversion rate quotes→sales. ~3 días.

---

### DT9 · Sin tests en remote functions 🟡

**Problema:** 58 archivos de test pero **cero** para `*.remote.ts`. La capa de lógica de negocio — donde viven comandos como `createSale`, `addSalePayment`, `confirmPurchaseOrder` — no tiene cobertura de tests unitarios. Los tests existentes cubren schemas, utils, helpers y queries, pero no la orquestación.

**Riesgo de no hacerlo:** Regresiones en comandos críticos (pagos, confirmaciones, ajustes de inventario) sin red de seguridad. Refactorizar remotes es peligroso.

**Contras:** Testear remotes requiere mock de DB (o testcontainers con PostgreSQL). Setup no trivial. Tiempo significativo.

**Dificultad:** Alta. **Solución:** (a) Setup de testcontainers con PostgreSQL + migraciones. (b) Tests de integración para los 10-15 comandos más críticos. (c) Incorporar al CI. (d) E2E: flujo completo del wizard óptico de venta/presupuesto (paso 2, confirmación, autosync del tipo de lente), pagos/cancelaciones/reembolsos, reportes. ~1-2 semanas.

---

## 2. Features Pendientes (Planes Activos)

### ✅ FP2 · backup-ui (COMPLETADO — 2026-08-10)

**Qué se implementó:**

El approach final difiere del plan original. En vez de Docker API + socket-proxy, se migró a Dokploy cron (container efímero) + UI basada en notificaciones.

**Fase 1 — Infra:**

- `backup/Dockerfile` simplificado: sin `entrypoint.sh` ni `crond`, CMD directo a `backup.sh`. Container efímero — ejecuta, sube a Drive, notifica y muere.
- `backup/entrypoint.sh` eliminado.
- `backup/backup.sh` mejorado: captura `ERROR_MSG` en cada paso (pg_dump, upload), notifica webhook con status real (no mentía con `curl || true`), soporta `GOOGLE_DRIVE_BACKUP_FOLDER_ID` vía `--drive-root-folder-id` de rclone (para subir a carpeta específica, no al root).
- `docker-compose-prod.yml`: servicio `backup` eliminado (Dokploy lo gestiona como Schedule Job).
- **Bug resuelto:** DNS stale de Docker (`127.0.0.11:53` se corrompía tras días) → al ser container efímero, cada ejecución tiene DNS fresco. Los uploads dejaron de fallar.
- Schedule Job en Dokploy: nombre `optikt-backup`, cron `0 2 * * *`, comando `docker run --rm` con todas las env vars inline. Network `dokploy-network`, hosts `optikt-database-tbgscg` y `optikt-app-8w0vr1`.

**Fase 2 — UI:**

- Migración DB `0037`: nuevo valor `BACKUP_FAILED` en enum `notification_type`.
- `NotificationType.BACKUP_FAILED` + `notifyBackupFailed()` en el servicio de notificaciones.
- Webhook `backup-webhook` actualizado: crea `BACKUP_CREATED` o `BACKUP_FAILED` según `status`, guarda tamaño y error en metadata.
- Query `getRecentBackupNotifications()` — filtra por ambos tipos, devuelve fileName, sizeBytes, error, createdAt.
- `src/lib/remote/backups.remote.ts`: `listBackupHistory`, `getBackupStatus`, `runBackup` (vía Dokploy API `POST /api/schedule.runManually` con `x-api-key`).
- Página `/backups` (solo SUPERADMIN): `+page.server.ts` con SSR (computa status del último registro, sin fetch client-side en carga inicial), `+page.svelte` con badge de estado (verde/amarillo/rojo), botón "Ejecutar backup ahora" (dispara el Schedule Job vía Dokploy API), tabla de historial.
- Componentes: `BackupsStatusBadge.svelte`, `BackupsTable.svelte`.
- Sidebar: `/backups` en `SUPER_ADMIN_ITEMS` con icono `HardDrive` de Lucide.
- Env vars nuevas: `DOKPLOY_API_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_BACKUP_SCHEDULE_ID`.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, `pnpm test:unit` 741 tests ✓. Probado en producción: backup automático funciona, webhook notifica correctamente, UI muestra historial y status, botón trigger dispara el job vía Dokploy API.

---

### ✅ FP1 · preserve-list-filters (COMPLETADO — verificado 2026-08-17)

**Qué se implementó** (sesión previa, verificado en código):

- `saveReferrerParams` (urlState.ts:35) wireado en las **6 listas**: sales, purchases, lenses, products, customers, quotes.
- `getBackUrl` / `peekBackUrl` (urlState.ts:47) wireado en los **6 detalles**: `quotes/[id]`, `lenses/[id]`, `products/[id]`, `sales/[id]`, `customers/[id]`, `purchases/[id]` (PurchaseOrderDetailHeader.svelte:48).
- Volver desde detalle restaura query params de la lista (filtros + búsqueda).

**Verificación:** rg sobre `src/routes` confirma los 12 puntas (6 save + 6 back).

---

### ✅ FP4 · Flujo de estados de venta (COMPLETADO — 2026-08-10)

**Problema resuelto:** El pago completo de una venta la forzaba a `COMPLETED` automáticamente. Un cliente que paga por adelantado (producto no listo aún) quedaba como "completada" — falso. Y no existía un estado "listo para retirar" ni forma de revertir errores.

**Qué se implementó:**

- **Nuevo estado `READY` ("Lista para Retirar")**: enum + label + badge (purple), migración `0038` (`ALTER TYPE sale_status ADD VALUE 'READY'`, idempotente), filtro de listado actualizado.
- **Se eliminó el auto-complete**: `addPayment` ya no cambia el estado al quedar cubierta la venta.
- **Modal post-pago** (`SaleStatusModal`): al completar el pago, pregunta qué estado poner — PENDING → [En Progreso, Lista para Retirar, Completada]; IN_PROGRESS → [Lista para Retirar, Completada]; o "mantener".
- **Transiciones manuales bidireccionales** vía comando unificado `setSaleStatus` (reemplaza `markAsInProgress`/`markAsCompleted`):
  - Adelante (→ COMPLETED): cualquier usuario con permiso sobre la venta.
  - Atrás (revertir): solo ADMIN/MANAGER (badge "Revertir" en el modal).
  - `completedAt` se setea al entrar a COMPLETED y se borra al salir.
- **Consistencia**: `voidPayment` revierte READY→IN_PROGRESS si queda underpaid; `updateSale` trata READY como IN_PROGRESS (solo admin edita); botón Cancelar disponible también en READY.
- **Bugfix**: array inline de `sales/+page.svelte` tenía `'REFUNDED'` (un RefundStatus, no SaleStatus) — ahora importa `ALL_SALE_STATUSES` compartido.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` pasa, 736/736 tests ✓.

**Nota operativa:** las ventas PENDING ya pagadas antes del deploy quedan en PENDING — se transicionan manualmente con el modal. `completedAt` sigue siendo el ancla de revenue recognition (solo se setea en COMPLETED).

---

### FP5 · Historial de estados en venta 🟡

**Problema:** Las transiciones de estado ya se registran en `change_history` (auditoría con diff, motivo, timestamp y usuario — via `auditService.logUpdate` en `setSaleStatus` y en el revert por `voidPayment`), pero el `ChangeHistoryModal` no está integrado en la página de detalle de venta. El operador no puede consultar cuándo/cómo cambió el estado desde el UI.

**Por qué importa:** El modal de estados permite revertir (admin) — sin historial visible no se puede auditar quién revirtió ni por qué. Los demás módulos (products, lenses) ya tienen el modal; ventas es el hueco.

**Contras:** Ninguno técnico. Solo UI.

**Dificultad:** Baja (1-2 días). **Solución:** (a) Integrar el `ChangeHistoryModal` existente en `sales/[id]/+page.svelte` con entityType `sale` y botón "Historial" junto a los otros acciones. (b) Opcional: timeline dedicado de estados (PENDIENTE → EN PROGRESO → LISTA PARA RETIRAR → COMPLETADA) filtrando `change_history` por diffs que toquen el campo `status`.

**Estado:** Pendiente. Sin empezar.

---

### ✅ FP6 · Carga lazy del catálogo + búsqueda con ranking (COMPLETADO — 2026-08-17)

**Qué se implementó:**

- **SSR sin catálogo** en las 4 páginas (`/sales/new`, `/purchases/new`, `/sales/[id]`, `/purchases/[id]/edit`): payload ~1MB → ~10KB.
- **`searchCatalog`** (`src/lib/remote/catalog.remote.ts` + `CatalogSearchSchema`): productos con relevancia SQL por tokens; lentes con token+ranking (mismo que `/lenses`); filtro `supplierId` para compras.
- **`getCatalogItemsByIds`**: seed del cache con items existentes (edición venta/PO).
- **`catalogCache.svelte.ts`**: cache reactivo compartido (`Map<id, obj>`) — los helpers existentes (stock, buildSaleItems, Rx confirmation) funcionan sin cambios.
- **SearchBar venta step 2**: debounce 250ms + loader (sin flash "Sin resultados") + race-guard.
- **Wizard compras**: fetch del set del proveedor al elegirlo; combobox con search server + fuente local.
- **`EditSaleModal`/`ItemSelect`**: typeahead server-side.
- **`universalSearch`** (nav): reemplaza los `ilike` tontos por el search con ranking (DTOs intactos).
- **Extra**: lentes buscables por source — "terminado", "laboratorio", "tallado" (sinónimo LAB), "lab", "finished" (raw).
- Plan detallado: `docs/plans/lazy-catalog-search.md`.

**Verificación:** `pnpm check` 0 errores, `pnpm lint` limpio, 755/755 tests.

---

**Problema:** La óptica no tiene presencia web. No hay landing page, no hay catálogo público. El plan anterior (API Go + Tailscale Funnel + RustFS) se descartó por fragilidad ante cortes de luz.

**Por qué importa:** Es el producto externo. Sin landing page, los clientes no descubren la óptica en internet. En Venezuela la competencia ya tiene presencia web.

**Contras:** Dependencia en Cloudflare R2 (aunque free tier generoso: 10GB, egress gratis). Sharp (libvips nativo) puede dar problemas de compilación en el droplet. Es la feature más grande del roadmap.

**Dificultad:** Alta. **Solución:** Arquitectura R2-first: (a) Migración DB con `product_publications` y `brand_publications` (flags de publicación, sin duplicar contenido). (b) Vistas SQL `public_catalog_products`/`public_brands` como contrato canónico. (c) Widget de upload de imágenes con sharp→WEBP multiresolución + subida a R2. (d) Snapshot generator que lee la vista y pushea JSON a R2 `/catalog/`. (e) Sync on-change + re-push horario. (f) La landing (repo aparte) consume de R2 vía HTTPS. ~2-3 semanas.

**Estado:** Plan activo. Arquitectura definida en `public-catalog-arch`. Sin empezar.

---

## 3. Features Propuestas

### NF1 · Órdenes de Laboratorio 🔴

**Problema:** El flujo de enviar una prescripción + frame a un laboratorio para fabricar lentes es completamente manual hoy. El sistema tiene suppliers tipo `LABORATORY` pero no se usan para tracking.

**Por qué importa:** Es el core workflow de una óptica. Sin tracking digital: pérdida de órdenes, demoras sin visibilidad, cliente llama y no se sabe dónde está su pedido.

**Contras:** Agrega complejidad al schema y UI. Los laboratorios reales no se integrarán vía API (estamos en Venezuela) — será tracking manual de estados.

**Impacto:** Crítico. **Dificultad:** Alta. **Overview:** (a) Nueva tabla `lab_orders`: supplier_id, sale_item_id, prescription_id, status (PENDING/SENT/IN_PRODUCTION/READY/RECEIVED/REJECTED), fechas, notas, costo. (b) UI: crear orden desde venta/prescripción, lista de órdenes activas, filtro por estado, cambio de estado con timestamp. (c) Dashboard widget: órdenes pendientes/atrasadas. (d) Auditoría de cambios de estado. ~2 semanas.

---

### NF2 · Citas / Agenda 🟡

**Problema:** Los exámenes de vista, ajustes de frames y entregas de pedidos se agendan en papel o WhatsApp. Sin visibilidad de quién viene cuándo.

**Por qué importa:** Proceso diario sin digitalizar. El dueño no sabe su carga de trabajo del día. Clientes sin recordatorio = no-shows.

**Contras:** Funcionalidad que requiere adopción del equipo. Si nadie la usa, es código muerto.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nueva tabla `appointments`: customer_id, user_id (quién atiende), type (EXAM/ADJUSTMENT/DELIVERY/OTHER), date + time, duration, status (SCHEDULED/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW), notes. (b) Vista de calendario semanal/diario. (c) CRUD con modal rápido. (d) Dashboard widget: citas del día. (e) Opcional futuro: recordatorios WhatsApp. ~1 semana.

---

### NF3 · Venta Rápida (POS) 🟡

**Problema:** El wizard de venta actual (3 pasos: cliente → items → pago) es lento para ventas simples (gotas, estuches, accesorios, cliente walk-in sin registro previo).

**Por qué importa:** Agiliza el 40% de las transacciones (ventas pequeñas). El vendedor pierde tiempo en pasos innecesarios.

**Contras:** Dos flujos de venta que mantener. Si divergen en lógica, bugs dobles. Debe reusar los mismos remote commands.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nuevo modo "Venta rápida" accesible desde el dashboard. (b) Pantalla única con: búsqueda de producto (autocomplete), cantidad, búsqueda de cliente (o "consumidor final"), método de pago, monto. (c) Botón grande "Cobrar". (d) Internamente usa el mismo `createSale` + `addSalePayment` remote commands. (e) No reemplaza el wizard — son dos modos. ~1 semana.

---

### NF4 · Garantías 🟡

**Problema:** Frames y lentes tienen garantía de fabricante (6-24 meses). Hoy no se trackea fecha de compra, vencimiento ni reclamos. Si un cliente vuelve con un frame roto, no hay registro.

**Por qué importa:** Requisito legal (derecho a garantía) y operativo (relación con proveedores). Sin tracking, la óptica asume costo de garantías que debería cubrir el fabricante.

**Contras:** Agrega entidad nueva. Si el volumen de reclamos es bajo, puede ser overkill.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Nueva tabla `warranties`: sale_item_id, product_id/lens_id, duration_months, warranty_start, warranty_end, manufacturer, terms. (b) Nueva tabla `warranty_claims`: warranty_id, claim_date, issue_description, status (PENDING/APPROVED/REJECTED/RESOLVED), resolution, cost_covered_by. (c) UI: ver garantías activas desde producto y cliente. (d) Alertas: garantías próximas a vencer. ~1 semana.

---

### NF5 · Dashboard con Gráficos 🟡

**Problema:** El dashboard actual son 4 números en tarjetas. Sin tendencias, sin comparativas, sin breakdowns. El dueño no puede ver si el negocio mejora o empeora.

**Por qué importa:** Toma de decisiones basada en datos. Un dashboard visual permite detectar caídas de ventas, productos estrella, vendedores top, estacionalidad.

**Contras:** Agregar librería de charts (peso). Los datos que se muestran requieren queries nuevos.

**Impacto:** Alto. **Dificultad:** Baja. **Overview:** (a) Agregar `layercake` o `chart.js`. (b) Nuevos KPIs con gráficos: revenue diario (últimos 30 días, bar chart), top 10 productos (bar horizontal), profit margin trend (línea), conversión quotes→ventas (porcentaje), ventas por vendedor (stacked bar). (c) Date range picker: hoy / esta semana / este mes / custom. (d) Los queries de agregación ya existen en `dashboard.ts` — extenderlos. ~3 días.

---

### NF6 · Carga de Imágenes de Productos 🟡

**Problema:** Los productos tienen `imageUrl` como campo de texto libre. Sin upload, sin preview, sin redimensionamiento. Cada imagen hay que hostearla en otro lado y pegar URL.

**Por qué importa:** Sin imágenes, los productos son invisibles. Solapa con `public-catalog-api` (que necesita imágenes para la landing). Es absurdo tener un catálogo de frames sin fotos.

**Contras:** Sharp (libvips) puede dar problemas de compilación nativa en el droplet. Si no se configura bien, puede llenar el disco de R2.

**Impacto:** Alto. **Dificultad:** Media. **Overview:** (a) Reutilizar la infraestructura sharp+R2 definida en `public-catalog-arch`. (b) `ImageUpload.svelte`: drag & drop, preview, progreso. (c) Al subir: sharp genera 400w/800w/1200w WEBP + original → R2 `/media/products/<uuid>-<size>.webp`. (d) Guardar solo el base key en `imageUrl`. (e) Aplicar en ProductForm, BrandForm, Settings (logo). ~1 semana (comparte infraestructura con FP3).

---

### NF7 · Visor Global de Auditoría 🟢

**Problema:** El `change_history` existe y se consulta en contexto (detalle de producto, lente, orden de compra). Pero no hay una página dedicada donde ver todos los cambios del sistema en un solo lugar.

**Por qué importa:** Transparencia operativa. Cuando algo falla, el admin necesita buscar "quién cambió qué y cuándo" sin adivinar en qué detalle de entidad buscar. Compliance básico.

**Contras:** Si la tabla `change_history` crece mucho, la página puede ser lenta sin paginación server-side.

**Impacto:** Medio. **Dificultad:** Baja. **Overview:** (a) Nueva ruta `/audit` (SUPERADMIN). (b) Componente `AuditLogViewer.svelte`: tabla filtrable por usuario, entidad, fecha (rango), acción. (c) El query `getEntityHistory()` ya existe y soporta filtros. (d) Paginación server-side. (e) Exportar CSV. ~2 días.

---

### NF8 · Comisiones por Vendedor 🟢

**Problema:** No hay forma de calcular cuánto vendió cada vendedor ni cuánto debería ganar en comisiones. Las ventas tienen `sellerId` pero no se explota.

**Por qué importa:** Motivación del equipo. Sin comisiones transparentes, no hay incentivo para vender más. En retail óptico, las comisiones son estándar.

**Contras:** Las reglas de comisión varían (¿% fijo? ¿por producto? ¿por marca? ¿escalonado?). El MVP debería ser simple y extensible. Puede generar conflictos si los números no cuadran.

**Impacto:** Medio. **Dificultad:** Media. **Overview:** (a) Nueva tabla `commission_rules`: user_id (opcional, global si null), product_type/brand_id (opcional), percentage, min_sale_amount, valid_from, valid_until. (b) Nueva tabla `commissions`: sale_id, sale_item_id, user_id, amount, percentage, rule_id, calculated_at. (c) Cálculo automático post-sale. (d) Reporte `/reports/commissions`: por vendedor, por período, total, detalle. (e) Dashboard widget: top vendedores del mes. ~1 semana.

---

### NF9 · Múltiples Sucursales ⚪

**Problema:** No existe `branch_id` en ninguna tabla. Si la óptica abre una segunda sucursal, no hay forma de separar inventario, ventas, clientes, usuarios por ubicación.

**Por qué importa:** Es la feature que define si el sistema escala con el negocio o se queda en la primera sucursal. Si no está desde el inicio, migrarlo después es extremadamente costoso.

**Contras:** **Muy costoso.** Requiere migración DB masiva (agregar `branch_id` a 15+ tablas), adaptar TODOS los queries (WHERE branch_id = $1), adaptar toda la UI, y crear UI de transferencias entre sucursales. Si la óptica nunca crece a 2+ sucursales, fue tiempo perdido.

**Impacto:** Alto (si hay crecimiento). **Dificultad:** Muy Alta. **Overview:** (a) Nueva tabla `branches`: name, address, phone, is_active. (b) Agregar `branch_id FK` a: users, customers, sales, quotes, purchase_orders, inventory_lots, inventory_movements, cash_expenses, settings (o hacer settings multibranch), inventory_count_sessions, products (stock por sucursal). (c) Session guarda branch_id del usuario. (d) Todos los queries filtran por branch_id del usuario autenticado. (e) SUPERADMIN ve todas las sucursales. (f) UI de transferencia de inventario entre sucursales. (g) Dashboard y reportes permiten filtrar por sucursal. ~3-4 semanas.

---

### NF10 · Exportación Excel (XLSX) 🟢

**Problema:** La exportación actual es solo CSV. Los contadores y administradores esperan Excel con formato, hojas múltiples y totals.

**Por qué importa:** Los reportes en CSV se ven mal al abrir en Excel (columnas desalineadas, tildes rotas, fechas como texto). Profesionalismo.

**Contras:** Agregar dependencia `xlsx` (o `exceljs`). Peso adicional.

**Impacto:** Bajo. **Dificultad:** Baja. **Overview:** (a) Agregar librería `xlsx` (~200KB). (b) Extender `downloadCsv()` → `downloadExcel()` en `src/lib/utils/csv.ts`. (c) Aplicar a los 6 reportes actuales. (d) Opcional: formatting (negritas, colores, auto-width). ~1 día.

---

### NF11 · Lector de Código de Barras 🟢

**Problema:** Sin campo `barcode` en productos. Sin soporte para scanner USB (que emula teclado + Enter). El conteo de inventario y la venta al mostrador requieren buscar productos por nombre/SKU manualmente.

**Por qué importa:** Velocidad. Un scanner USB cuesta $20 y acelera drásticamente el conteo de inventario (que hoy es manual con papel) y la venta rápida.

**Contras:** Ninguno significativo. El scanner USB es plug & play (emula teclado).

**Impacto:** Medio. **Dificultad:** Baja. **Overview:** (a) Agregar `barcode` varchar nullable a `products`. (b) Input con `autofocus` y handler de `Enter` en POS y en inventory count para búsqueda instantánea por barcode. (c) Si el barcode no existe, mostrar opción de crearlo. ~2 días.

---

## Resumen de Esfuerzo

| Prioridad | Ítem                           | Esfuerzo                |
| --------- | ------------------------------ | ----------------------- |
| ✅        | FP2 · backup-ui                | Completado              |
| ✅        | FP4 · Estados de venta         | Completado              |
| 🟡        | FP5 · Historial estados venta  | 1-2 días                |
| ✅        | FP6 · Catálogo lazy + ranking  | Completado              |
| ✅        | FP1 · preserve-list-filters    | Completado              |
| ✅        | DT4 · Console.log en prod      | Completado              |
| ✅        | DT2 · Errores silenciados      | Completado              |
| ✅        | DT3 · Validación Zod           | Completado              |
| ✅        | DT5 · Error pattern duplicado  | Completado              |
| 🟡        | DT10 · Zod refinements negocio | 5 días                  |
| ✅        | DT11 · Dead code componentes   | Completado              |
| ✅        | DT15 · Altura en presupuestos  | Completado              |
| 🟢        | DT12 · Tablas duplicadas       | 2 días                  |
| 🟡        | DT13 · Enums moneda            | 1 día                   |
| 🟢        | DT16 · Enums moneda gastos     | 2 días                  |
| 🟡        | DT14 · Wizard compras SSR      | Absorbido por FP6       |
| ❌        | FP3 · public-catalog-api       | 15 días                 |
| 🟡        | DT1 · Archivos gigantes        | 15-20 días (5 archivos) |
| 🟡        | DT8 · Dashboard gráficos       | 3 días                  |
| 🟡        | NF1 · Órdenes laboratorio      | 10 días                 |
| 🟡        | NF2 · Citas/agenda             | 5 días                  |
| 🟡        | NF3 · POS rápido               | 5 días                  |
| 🟡        | NF4 · Garantías                | 5 días                  |
| 🟡        | NF6 · Upload imágenes          | 5 días                  |
| 🟡        | DT6 · Soft-delete consistente  | 3 días                  |
| 🟡        | DT9 · Tests remote funcs       | 10 días                 |
| 🟢        | NF7 · Visor auditoría          | 2 días                  |
| 🟢        | NF10 · Export Excel            | 1 día                   |
| 🟢        | NF11 · Código barras           | 2 días                  |
| 🟢        | DT7 · PDF stack limpio         | 2 días                  |
| 🟢        | NF8 · Comisiones               | 5 días                  |
| ⚪        | NF9 · Multi-sucursal           | 20 días                 |

**Total estimado:** ~125 días-hombre. **Quick wins (🔴 bajo esfuerzo):** DT13 (1 día) para limpiar la consolidación de monedas.

---

## Orden de Ataque Sugerido

```
Semana 1:  FP1 (preserve-list-filters)
Semana 2:  FP1 (preserve-list-filters)
Semana 3-5: FP3 inicio (public-catalog-api)
Semana 6:  DT8 (dashboard gráficos)
Semana 7-8: DT1 parcial (LensCatalogForm + EditSaleModal)
Semana 9:  NF1 (órdenes laboratorio)
Semana 10: NF6 (upload imágenes, coincide con FP3)
...
```
