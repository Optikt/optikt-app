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
- ✅ **327 tests** — Vitest (schemas, helpers, validación Rx, quotes, tax, inventory)
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

- **Test de integración FIFO E2E** — test que crea lote → venta → verifica lot.quantity_available en DB → cancela → verifica rollback. Cubre single-lot y multi-lot scenarios. Incluir verificación de inventory_movements (SALE_OUT / CANCEL_REVERT).
- Conteo físico multi-item (inventario físico: ver todos los productos, ingresar stock real, el sistema genera ajustes por diferencias)
- Historial de movimientos por venta (sección en detalle de venta mostrando qué lotes se afectaron)
- Credit Notes / RETURN_IN con reembolso y ajuste financiero
- Ajustes de inventario para lentes (catálogo de lentes con stock)
- Exportar movimientos a CSV/PDF
- Surplus / excedentes físicos de cristales
- Fulfillment planner (unit/pair policies, procurement engine)
- Búsqueda global con scopes/prefijos y parser óptico
- Políticas de tratamiento heredadas por proveedor (`supplier_treatment_policies`)
- Presupuestos: expiración automática, historial de revisiones
- Facturación electrónica / PDF oficial
- Multi-sede / multi-usuario con permisos granulares

---

## Deuda técnica conocida

| ID   | Descripción                                                                                                                                                                                                                                                                                                                           | Riesgo      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| RT-1 | Estandarizar `ReactivateXxxSchema` a key único y factory function                                                                                                                                                                                                                                                                     | Medio       |
| RT-2 | Consolidar `getXxxLabel()` / `getXxxBadgeColor()` en helpers genéricos                                                                                                                                                                                                                                                                | Bajo        |
| RT-3 | Componente genérico `ReactivateEntityModal` (5 modals casi idénticos)                                                                                                                                                                                                                                                                 | Medio       |
| RT-4 | ~~Fallback para errores de validación no vinculados a campos visibles~~ — RESUELTO: `toastUnboundErrors()` en 13 form components + mensajes Zod custom en español | ✅ |
| RT-5 | Backfill `payment_date` en `sale_payments` — ejecutar migración que haga `UPDATE sale_payments SET payment_date = created_at WHERE payment_date IS NULL`, luego marcar la columna como `NOT NULL`. Tras eso, eliminar el `COALESCE` en `getReportPayments()` y usar directamente `salePayments.paymentDate` (quitar import de `sql`). | Bajo        |
| RT-6 | Reemplazar `src/lib/utils/csv.ts` (helper manual) por [`export-to-csv`](https://github.com/alexcaza/export-to-csv) — paquete ligero y mantenido. Eliminar `generateCsv()` / `downloadCsv()` y sus tests.                                                                                                                              | Bajo        |

---

## Checklist de fases

- [x] Schema DB simplificado
- [x] CRUD completo (todas las entidades)
- [x] Wizard de ventas (happy path completo)
- [x] inventoryMode ON_DEMAND / STOCK
- [x] Tests (327)
- [x] Fase 6 — Presupuestos
- [x] Fase 7 — IVA básico
- [x] Fase 8 — Dashboard real
- [x] Fase 9 — Reportes básicos
- [x] FIFO Inventory + Órdenes de Compra + Movimientos
- [ ] Fase 10 — Rediseño UI/UX
