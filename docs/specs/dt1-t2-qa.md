# Spec: dt1-t2-qa

Scope: feature

# Feature: Aceptación split sales detail T2

Scope: feature
Vinculado a: dt1-t2-sales

## Objetivo

Descomponer `sales/[id]/+page.svelte` sin cambiar comportamiento visible del detalle de venta.

## Alcance — Incluido

- 6 secciones en `src/lib/components/sales/detail/` + `saleDetail.ts` puro con spec espejo.
- Wiring intacto: `EditSaleModal`, `CancelSaleModal`, `SaleStatusModal`, `SaleMovementsModal`, `PDFViewerModal`, `SaleAuditHistoryDrawer`, `SaleItemsTable`, `SaleAuditTimeline`, `PaymentForm` (kind sale, variant drawer).

## QA — Detalle (F7)

- [ ] Carga: cliente, vendedor, orden, fecha, estado, totales, pagos, movimientos, auditoría
- [ ] Acciones por rol/estado: Cambiar Estado, Editar, Cancelar, Ver/Imprimir PDF, Tickera, stock
- [ ] Avisos: notas, cancelación + reembolso (montos, motivo, por), free items pendientes
- [ ] Resumen: subtotal, descuento %, IVA, total, saldo + progreso, botón Cobrar solo si saldo > 0.01
- [ ] Pagos: lista Bs (tasa BCV), USDT (tasa), efectivo; vacío muestra placeholder

## QA — Regresión pago (F1) y edición (F4)

- [ ] Cobrar abre drawer con saldo; pago registra, cierra drawer, refresca; al saldar ofrece cambio de estado con presets correctos
- [ ] Editar abre `EditSaleModal` con items; guardar refresca detalle
- [ ] Cancelar y cambiar estado refrescan vía `invalidateAll` + `syncFromData`

## Gates

`pnpm check` 0, `pnpm lint`, `pnpm test:unit`, size sin FAIL en scope, `rg` cero imports rotos.