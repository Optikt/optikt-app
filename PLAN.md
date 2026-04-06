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
- ✅ **347 tests** — Vitest (schemas, helpers, validación Rx, quotes, tax, inventory, FIFO E2E scenarios)
- ✅ **Seed de demo** — datos de ejemplo para desarrollo
- ✅ **Presupuestos (Fase 6)** — CRUD, wizard 3 pasos, conversión a venta, estados, quoteNumber secuencial, audit logging
- ✅ **IVA básico (Fase 7)** — tax-inclusive pricing, desglose fiscal en ventas/presupuestos, TaxToggle, default 16%
- ✅ **Dashboard real (Fase 8)** — StatCards, cobros pendientes, ventas recientes, bajo stock, quick actions
- ✅ **Reportes básicos (Fase 9)** — ventas/pagos por período, inventario lentes, exportación CSV/impresión
- ✅ **FIFO Inventory** — lotes, movimientos inmutables, costo FIFO, weighted average cost, ajustes manuales, `consumeFifoForSaleItem()` compartido
- ✅ **Órdenes de Compra** — CRUD, confirmación con creación de lotes, sugerencia de precios, reversión de lotes
- ✅ **Historial de Movimientos** — página unificada `/purchases/movements`, sección en detalle de producto, filtro por fecha/tipo/documento

---

## Fases pendientes

### Fase 10 — Rediseño UI/UX

**Alcance:**

- Revisión visual de todas las pantallas clave (~15 screens)
- Consistencia tipográfica, espaciado, colores semánticos
- Sin cambios en lógica de negocio

---

## Backlog (pospuesto intencionalmente)

Estos items se agregan cuando aparezca una necesidad real en uso:

- ✅ **Reporte de ventas: excluir canceladas de totales** — resuelto en `fix-sales-report-exclude-cancelled`. Totales solo incluyen ventas activas, tarjeta separada para anuladas, filtro por estado (activas/anuladas/todas), CSV respeta filtro.
- ✅ **Test de integración FIFO E2E** — resuelto en `pre-redesign-tasks`. 26 tests cubriendo: single/multi-lot lifecycle, sale→cancel→rollback, ajustes, costos FIFO, audit trail de movimientos, invariante cached stock.
- ✅ **Historial de movimientos por venta** — resuelto en `pre-redesign-tasks`. Sección de MovementsTable en detalle de venta con movimientos SALE_OUT/CANCEL_REVERT.
- ✅ **Exportar movimientos a CSV** — resuelto en `pre-redesign-tasks`. Botón en /purchases/movements exporta datos filtrados con fecha, tipo, producto, lote, cantidades, costo, notas, usuario.
- ✅ **Cancelación de venta con pago parcial** — resuelto: decisión binaria retener/reembolsar por el monto completo pagado. El servidor auto-asigna `refundAmount = paidAmountBcvUsd`. Para ajustes parciales se usa registro manual de gasto.
- **Módulo de Ingresos y Egresos** — registro de gastos operativos (impuestos, salarios, alquileres, ajustes manuales de reembolso parcial, etc.). Complementa cancelaciones con retención. Permite contabilidad básica sin depender del libro contable.
- Credit Notes / RETURN_IN con reembolso y ajuste financiero
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
- [x] Tests (347)
- [x] Fase 6 — Presupuestos
- [x] Fase 7 — IVA básico
- [x] Fase 8 — Dashboard real
- [x] Fase 9 — Reportes básicos
- [x] FIFO Inventory + Órdenes de Compra + Movimientos
- [ ] Fase 10 — Rediseño UI/UX
