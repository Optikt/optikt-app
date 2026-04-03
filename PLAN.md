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
- ✅ **265 tests** — Vitest (schemas, helpers, validación Rx, quotes, tax)
- ✅ **Seed de demo** — datos de ejemplo para desarrollo
- ✅ **Presupuestos (Fase 6)** — CRUD completo, wizard 3 pasos, conversión a venta, estados DRAFT→APPROVED→CONVERTED|CANCELLED|EXPIRED
- ✅ **IVA básico (Fase 7)** — tax-inclusive pricing, desglose fiscal en ventas/presupuestos, 265 tests

---

## Fases pendientes

### ~~Fase 6 — Presupuestos~~ ✅ COMPLETADA

Happy path: crear un presupuesto con ítems, enviárselo al cliente, y convertirlo a venta cuando acepte.

**Implementado:**

- Tablas: `quotes`, `quote_items` (schema + relaciones + queries)
- CRUD: crear (wizard 3 pasos), listar (filtros + paginación), ver detalle, cancelar
- Aprobar presupuesto (DRAFT → APPROVED)
- Convertir a venta (APPROVED → CONVERTED, crea venta + decrementa stock)
- Estado: `DRAFT → APPROVED → CONVERTED | CANCELLED | EXPIRED`
- `quoteNumber` secuencial (mismo patrón que `orderNumber`)
- Cliente opcional al presupuestar, requerido al convertir a venta
- 30 tests (24 schemas + 6 contracts)
- Componentes: QuotesTable, NewQuoteForm, QuoteStep1Info, QuoteStep3Summary, QuoteStatusBadge
- Audit logging con entity type `quote`

---

### ~~Fase 7 — IVA básico en productos~~ ✅ COMPLETADA

**Implementado:**

- DB: `isTaxable`, `taxRate`, `salePrice` en productos y supplier treatments; `snapshotIsTaxable`, `snapshotTaxRate` en sale_items y quote_items
- Tax-inclusive pricing: `decomposePrice()` descompone precio total → base + IVA; `computeTaxBreakdown()` para listas de items
- UI toggle (TaxToggle component) en ProductForm, LensCatalogForm, SupplierTreatmentsModal
- Desglose fiscal (TaxBreakdownDisplay component) en wizard de ventas (Step 3), wizard de presupuestos (Step 3), detalle de venta, detalle de presupuesto
- Helpers compartidos: `buildTaxItemsFromWizard()`, `computeSnapshotTaxBreakdown()` en saleItemHelpers
- Schemas: CoercedBoolean para campos de formulario que envían strings
- Error display: wired up `error` prop en CreatableSelects de ProductForm (supplierId, materialId, brandId)
- 265 tests (15 nuevos para tax helpers)
- Default: productos gravables al 16%, lentes exentos

**Fuera de scope (se mantiene):**

- Configuración global de tasas
- IVA en reportes fiscales detallados
- Facturación electrónica

---

### ~~Fase 8 — Dashboard con datos reales~~ ✅ COMPLETADA

**Implementado:**

- Dashboard queries: `getDashboardStats()`, `getRecentSales()`, `getLowStockItems()` con ejecución paralela
- 4 StatCards: Clientes totales, Ventas Hoy (cantidad + monto), Presupuestos Pendientes (DRAFT), Bajo Stock (productos + lentes)
- Banner condicional de cobros pendientes (PENDING) con monto y enlace a ventas filtradas
- RecentSalesTable: últimas 5 ventas con número, estado, cliente, total, fecha (filas clickeables)
- LowStockList: productos bajo mínimo + lentes STOCK con stock ≤ 0, con enlaces a detalle
- Quick Actions preservados (Nuevo Cliente, Agregar Producto, Registrar Venta, Catálogo de Lentes)
- Limpieza: eliminada `getLowStockProducts()` redundante de products.ts

**Fuera de scope (se mantiene):**

- Gráficas históricas
- Comparación periodos

---

### Fase 9 — Reportes básicos ✅ COMPLETADA

**Alcance:**

- Ventas por período (filtro fecha): listado con totales
- Pagos recibidos por período
- Inventario de lentes (stock actual por ítem)
- Exportación simple (CSV o impresión del navegador)

**Fuera de scope inicial:**

- Reportes fiscales / IVA
- Reportes por vendedor
- Dashboards analíticos complejos

---

### Fase 10 — Rediseño UI/UX

**Alcance:**

- Revisión visual de todas las pantallas clave (~15 screens)
- Consistencia tipográfica, espaciado, colores semánticos
- Sin cambios en lógica de negocio

---

## Backlog (pospuesto intencionalmente)

Estos items se agregan cuando aparezca una necesidad real en uso:

- Surplus / excedentes físicos de cristales
- Fulfillment planner (unit/pair policies, procurement engine)
- Búsqueda global con scopes/prefijos y parser óptico
- Políticas de tratamiento heredadas por proveedor (`supplier_treatment_policies`)
- Presupuestos: expiración automática, historial de revisiones
- Facturación electrónica / PDF oficial
- Multi-sede / multi-usuario con permisos granulares

---

## Deuda técnica conocida

| ID   | Descripción                                                                                                                                                                                                                                                                                                                                         | Riesgo |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| RT-1 | Estandarizar `ReactivateXxxSchema` a key único y factory function                                                                                                                                                                                                                                                                                   | Medio  |
| RT-2 | Consolidar `getXxxLabel()` / `getXxxBadgeColor()` en helpers genéricos                                                                                                                                                                                                                                                                              | Bajo   |
| RT-3 | Componente genérico `ReactivateEntityModal` (5 modals casi idénticos)                                                                                                                                                                                                                                                                               | Medio  |
| RT-4 | Fallback para errores de validación no vinculados a campos visibles — cuando un campo no tiene `error` prop wired, el error de schema es completamente silencioso (solo visible en Network tab). Implementar un catch-all: tras submit, si `allIssues()` tiene errores sin elemento `.border-red-500` en el DOM, mostrar toast con campo + mensaje. | Alto   |
| RT-5 | Backfill `payment_date` en `sale_payments` — ejecutar migración que haga `UPDATE sale_payments SET payment_date = created_at WHERE payment_date IS NULL`, luego marcar la columna como `NOT NULL`. Tras eso, eliminar el `COALESCE` en `getReportPayments()` y usar directamente `salePayments.paymentDate` (quitar import de `sql`).               | Bajo   |

---

## Checklist de fases

- [x] Schema DB simplificado
- [x] CRUD completo (todas las entidades)
- [x] Wizard de ventas (happy path completo)
- [x] inventoryMode ON_DEMAND / STOCK
- [x] Tests (245)
- [x] Fase 6 — Presupuestos
- [x] Fase 7 — IVA básico
- [x] Fase 8 — Dashboard real
- [x] Fase 9 — Reportes básicos (271 tests)
- [ ] Fase 10 — Rediseño UI/UX
