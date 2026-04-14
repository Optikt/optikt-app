# PLAN MAESTRO — OPTIKT APP

## Postura de ejecución

- Happy path primero. Los edge cases se abordan cuando aparezcan en el uso real.
- No se prioriza compatibilidad hacia atrás (no hay producción real aún).
- Se prefiere código simple y directo sobre abstracciones preventivas.
- Velocidad de entrega > cobertura teórica de casos raros.

---

## Estado actual (completado)

- ✅ **Schema DB** — lentes, suppliers, ventas simplificado
- ✅ **CRUD completo** — clientes, marcas, materiales, productos, proveedores, treatments, lentes
- ✅ **Wizard de ventas** — 3 pasos: cliente → items + lentes + treatments → resumen + pago
- ✅ **Vista detalle de venta** — artículos consolidados, treatments como items, pagos
- ✅ **inventoryMode** — ON_DEMAND vs STOCK por lens catalog item
- ✅ **Order numbers** — secuencial sin gaps (MAX+1 dentro de transacción)
- ✅ **404 tests** — Vitest (schemas, helpers, validación Rx, quotes, tax, inventory, FIFO E2E scenarios)
- ✅ **Seed de demo** — datos de ejemplo para desarrollo
- ✅ **Presupuestos (Fase 6)** — CRUD, wizard 3 pasos, conversión a venta, estados, quoteNumber secuencial, audit logging
- ✅ **IVA básico (Fase 7)** — tax-inclusive pricing, desglose fiscal en ventas/presupuestos, TaxToggle, default 16%
- ✅ **Dashboard real (Fase 8)** — StatCards, cobros pendientes, ventas recientes, bajo stock, quick actions
- ✅ **Reportes básicos (Fase 9)** — ventas/pagos por período, inventario lentes, exportación CSV/impresión
- ✅ **FIFO Inventory** — lotes, movimientos inmutables, costo FIFO, weighted average cost, ajustes manuales, `consumeFifoForSaleItem()` compartido
- ✅ **Órdenes de Compra** — CRUD, confirmación con creación de lotes, sugerencia de precios, reversión de lotes
- ✅ **Historial de Movimientos** — página unificada `/purchases/movements`, sección en detalle de producto, filtro por fecha/tipo/documento
- ✅ **Costos internos de venta** — costos editables (cristales, montaje, envío) en wizard y post-venta, `shippingCostPending` flag, total costo interno en detalle, filtro "Envío pendiente" en lista de ventas, `updateItemCosts` remote command

---

## Fases pendientes

### Bugfixes resueltos (pre-Fase 10)

- ✅ **Reporte de pagos: reembolsos no deben restar ingresos** — Los reembolsos se mostraban como ingreso negativo en `/reports/payments`. Corregido: `netBcvUsd` ya no resta refunds (el pago ya está excluido de gross). La tabla de reembolsos se mantiene como historial informativo.
- ✅ **Cancel modal: sin default + confirmación doble** — Modal de cancelación de venta con pagos previos: sin opción pre-seleccionada (el usuario debe elegir explícitamente retener o reembolsar), "Reembolsar" a la izquierda, segundo modal de confirmación antes de ejecutar. Extraído a `CancelSaleModal` compartido (`SalesTable` + detalle de venta).
- ✅ **Migración malformada** — `0007_clumsy_human_robot.sql` tenía trailing garbage de un merge incorrecto. Corregido.

### Mejoras completadas en flujo de ventas (Fase 10-A)

- ✅ **Costos internos editables en wizard** — `SaleStep2Items`: layout compactado y horizontal, inputs editables para cristales/montaje/envío con `costOverrides`, checkbox "Envío pendiente" (`shippingCostPending`)
- ✅ **Costos internos visibles y editables post-venta** — `SaleItemsTable`: desglose inline (cristales, montaje, envío) con botón editar (pencil), modo edición inline con save/cancel, link "Agregar" para lentes sin costos, fila "Costo interno total" en footer
- ✅ **Filtro envío pendiente** — Botón toggle "Envío pendiente" con icono Truck en `/sales`, subquery EXISTS en `buildSaleConditions`, propagado por `ListSalesSchema` → `listSales` → `getAllSales`
- ✅ **Backend completo** — `UpdateSaleItemCostsSchema`, `updateSaleItemCosts()` query, `updateItemCosts` remote command con audit logging

### Refactor modelo de lentes y prescripciones (Fase 10-B)

- ✅ **Modelo comercial de cristales: 1 fila LENS_PAIR por par** — el wizard ahora serializa una única fila `LENS_PAIR` con ambos ojos (OD+OS) en vez de una fila por ojo. Helpers centralizados en `wizardSubmission.ts` (`buildSaleItemsFromWizard`, `buildQuoteItemsFromWizard`, `buildPrescriptionPayload`)
- ✅ **Creación de prescripción activa al registrar venta** — `sales.remote.ts` crea prescripción dentro de la transacción cuando la venta tiene lentes con datos de Rx. Se vincula `prescriptionId` a los items LENS_PAIR
- ✅ **Derivación de prescripción al convertir cotización a venta** — `quotes.remote.ts` extrae valores ópticos de los items LENS_PAIR de la cotización (`derivePrescriptionFromQuoteItems`), crea prescripción activa y vincula a los items de la venta
- ✅ **Costos canónicos de cristales** — `computeLensSnapshotCostTotal()` y `computeSnapshotCostUnit()` en `saleItemCosts.ts`, persistidos como `snapshotCostTotal` en sale items
- ✅ **Snapshot de prescripción en detalle de venta** — `hasPrescriptionSnapshot()` y `formatPrescriptionEye()` en `prescriptionSnapshot.ts`, renderizados en `SaleItemsTable`
- ✅ **Campo doctor/optómetra en prescripción de venta** — Input "Médico / Optómetra" en `PrescriptionInput.svelte`, validación client-side y server-side, autofill desde prescripción existente del paciente
- ✅ **Fix runtime `value.trim()` en inputs numéricos** — `WizardPrescriptionValues` acepta `string | number`, `hasPrescriptionValues` usa `String(value).trim()`

### Fase 10 — Rediseño UI/UX

**Alcance:**

- Alinear todas las pantallas con el design system "Precision Visionary" (brand-navy, brand-gold, brand-blue)
- Migrar de componentes Flowbite a componentes propios (DataGrid, PageHeader, glass-card, etc.)
- Consistencia tipográfica (Space Grotesk headings, Inter body), espaciado, colores semánticos
- Sin cambios en lógica de negocio

**Design System:** Stitch project `2149962653469234227`
**Referencia de tokens:** "Optikt Clarity - Semantic Updates Showcase" (`2025c374`)

#### Grupo A — Flujo de ventas (con mockup Stitch)

| #   | Pantalla               | Ruta                    | Mockup Stitch                                        | Estado     |
| --- | ---------------------- | ----------------------- | ---------------------------------------------------- | ---------- |
| A1  | Lista de ventas        | `/sales`                | "Lista de Ventas - Refinada" (`56909dd3`)            | ✅ Hecho   |
| A2  | Detalle de venta       | `/sales/[id]`           | "Detalle de Venta - Optikt" (`2aca5925`, `73d3f5f1`) | ✅ Hecho   |
| A3  | Nueva venta (wizard)   | `/sales/new`            | "Nueva Venta (Paso 1) - Optikt" (`fbf6a888`)         | ✅ Hecho   |
| A4  | Fórmula / prescripción | (componente compartido) | "Nueva Fórmula - Versión Colorida" (`70394b9c`)      | 🟡 Parcial |

#### Grupo B — Clientes (con mockup Stitch)

| #   | Pantalla            | Ruta              | Mockup Stitch                                             | Estado    |
| --- | ------------------- | ----------------- | --------------------------------------------------------- | --------- |
| B1  | Listado de clientes | `/customers`      | "Listado de Clientes - Tipografía Unbounded" (`2b3e61af`) | ⬚ Pending |
| B2  | Detalle de cliente  | `/customers/[id]` | "Detalle de Cliente - Refinado" (`d495664a`)              | ⬚ Pending |
| B3  | Nuevo cliente       | `/customers/new`  | "Nuevo Cliente - Refinada" (`9773df33`, `8b8204a7`)       | ⬚ Pending |

#### Grupo C — Dashboard & auth (con mockup Stitch)

| #   | Pantalla                   | Ruta         | Mockup Stitch                                       | Estado    |
| --- | -------------------------- | ------------ | --------------------------------------------------- | --------- |
| C1  | Dashboard                  | `/dashboard` | "Dashboard - Anotaciones Aplicadas" (`9d0e30d2`)    | ⬚ Pending |
| C2  | Dashboard — tasas cambio   | `/dashboard` | "Dashboard - Tasas de Cambio Abiertas" (`c393c22d`) | ⬚ Pending |
| C3  | Dashboard — perfil         | `/dashboard` | "Dashboard - Perfil Abierto" (`6ec34713`)           | ⬚ Pending |
| C4  | Dashboard — notificaciones | `/dashboard` | "Dashboard - Notificaciones Abiertas" (`7adaf78a`)  | ⬚ Pending |
| C5  | Login                      | `/login`     | "Login - Optik-T App" (`cd7932ab`)                  | ⬚ Pending |

#### Grupo D — Páginas sin mockup (migrar a design system)

Estas páginas usan Flowbite viejo. Se migran al design system sin mockup específico, usando los patrones establecidos en Grupo A–C como referencia.

| #   | Pantalla      | Ruta         | Estado     |
| --- | ------------- | ------------ | ---------- |
| D1  | Productos     | `/products`  | ⬚ Pending  |
| D2  | Marcas        | `/brands`    | ⬚ Pending  |
| D3  | Proveedores   | `/suppliers` | ⬚ Pending  |
| D4  | Presupuestos  | `/quotes`    | ✅ Hecho   |
| D5  | Usuarios      | `/users`     | ⬚ Pending  |
| D6  | Compras       | `/purchases` | ⬚ Pending  |
| D7  | Lentes        | `/lenses`    | ⬚ Pending  |
| D8  | Materiales    | `/materials` | ⬚ Pending  |
| D9  | Configuración | `/config`    | 🟡 Parcial |
| D10 | Reportes      | `/reports`   | 🟡 Parcial |

#### Orden sugerido de ejecución

1. ~~**A2 — Detalle de venta**~~ ✅
2. ~~**A3 — Nueva venta**~~ ✅
3. **A4 — Fórmula** → componente compartido parcial (funcional con doctor + autofill, falta rediseño visual completo del mockup Stitch `70394b9c`)
4. ~~**B1–B3 — Clientes**~~ ✅
5. ~~**C1–C4 — Dashboard**~~ ✅
6. ~~**C5 — Login**~~ ✅
7. ~~**D4 — Presupuestos**~~ ✅ (lista, detalle, wizard, conversión a venta — todos redesigned)
8. **D1–D3, D5–D10 — Páginas restantes** → migración progresiva sin mockup

---

## Backlog (pospuesto intencionalmente)

Estos items se agregan cuando aparezca una necesidad real en uso:

- ✅ **Reporte de ventas: excluir canceladas de totales** — resuelto en `fix-sales-report-exclude-cancelled`. Totales solo incluyen ventas activas, tarjeta separada para anuladas, filtro por estado (activas/anuladas/todas), CSV respeta filtro.
- ✅ **Test de integración FIFO E2E** — resuelto en `pre-redesign-tasks`. 26 tests cubriendo: single/multi-lot lifecycle, sale→cancel→rollback, ajustes, costos FIFO, audit trail de movimientos, invariante cached stock.
- ✅ **Historial de movimientos por venta** — resuelto en `pre-redesign-tasks`. Sección de MovementsTable en detalle de venta con movimientos SALE_OUT/CANCEL_REVERT.
- ✅ **Exportar movimientos a CSV** — resuelto en `pre-redesign-tasks`. Botón en /purchases/movements exporta datos filtrados con fecha, tipo, producto, lote, cantidades, costo, notas, usuario.
- ✅ **Cancelación de venta con pago parcial** — resuelto: decisión binaria retener/reembolsar por el monto completo pagado. El servidor auto-asigna `refundAmount = paidAmountBcvUsd`. Para ajustes parciales se usa registro manual de gasto.
- **Módulo de Ingresos y Egresos** — registro de gastos operativos (impuestos, salarios, alquileres, ajustes manuales de reembolso parcial, etc.). Complementa cancelaciones con retención. Permite contabilidad básica sin depender del libro contable.
- **Credit Notes / RETURN_IN** — devolución parcial de artículos con ajuste financiero e inventario. Tablas nuevas: `credit_notes` y `return_items` (aditivas, no modifica lo existente). Nuevo tipo de movimiento `RETURN_IN` (reutiliza `returnToLot()` de CANCEL_REVERT). UI: botón "Devolver artículos" en detalle de venta, selector de items/cantidades, vista de notas de crédito por cliente. **Caso común** (cancelación total) ya resuelto con el flujo actual. **Caso raro** (devolver 1 de N artículos) es lo que necesita esta feature. **Workaround temporal**: cancelar la venta completa y crear una nueva sin el artículo devuelto.
- Conteo físico multi-item (inventario físico: ver todos los productos, ingresar stock real, el sistema genera ajustes por diferencias)
- Ajustes de inventario para lentes (catálogo de lentes con stock)
- Surplus / excedentes físicos de cristales
- Fulfillment planner (unit/pair policies, procurement engine)
- Búsqueda global con scopes/prefijos y parser óptico
- Políticas de tratamiento heredadas por proveedor (`supplier_treatment_policies`)
- Presupuestos: expiración automática, historial de revisiones
- Facturación electrónica / PDF oficial
- Multi-sede / multi-usuario con permisos granulares

---

## Deuda técnica conocida

| ID   | Descripción                                                                                                                                                       | Riesgo |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| RT-1 | Estandarizar `ReactivateXxxSchema` a key único y factory function                                                                                                 | Medio  |
| RT-2 | Consolidar `getXxxLabel()` / `getXxxBadgeColor()` en helpers genéricos                                                                                            | Bajo   |
| RT-3 | Componente genérico `ReactivateEntityModal` (5 modals casi idénticos)                                                                                             | Medio  |
| RT-4 | ~~Fallback para errores de validación no vinculados a campos visibles~~ — RESUELTO: `toastUnboundErrors()` en 13 form components + mensajes Zod custom en español | ✅     |
| RT-5 | ~~Backfill `payment_date` en `sale_payments`~~ — RESUELTO: migración 0001 backfill + NOT NULL, eliminado fallback `?? createdAt` en reports y UI                  | ✅     |
| RT-6 | ~~Reemplazar `csv.ts` manual por `export-to-csv`~~ — RESUELTO: `downloadCsv()` usa `export-to-csv` internamente, eliminado `generateCsv()` y 6 tests manuales     | ✅     |

---

## Checklist de fases

- [x] Schema DB simplificado
- [x] CRUD completo (todas las entidades)
- [x] Wizard de ventas (happy path completo)
- [x] inventoryMode ON_DEMAND / STOCK
- [x] Tests (404)
- [x] Fase 6 — Presupuestos
- [x] Fase 7 — IVA básico
- [x] Fase 8 — Dashboard real
- [x] Fase 9 — Reportes básicos
- [x] FIFO Inventory + Órdenes de Compra + Movimientos
- [ ] Fase 10 — Rediseño UI/UX
