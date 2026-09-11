---
plan name: sale-createdat-truth
plan description: Fecha venta en created_at
plan status: active
---

## Idea
Eliminar columna sales.sale_date y convertir sales.created_at en única fecha-verdad de ventas: día editable desde form + hora del submit compuesta en zona America/Caracas (UTC-4) explícita y persistida como UTC. Schemas conservan nombre dominio saleDate como alias que el server mapea a columna createdAt (mínimo churn). Filtros, ordenamientos, reportes, tickera e impresión leen createdAt. Migración backfill created_at := fecha(sale_date) + hora(created_at) existentes, drop de columna e índice, índice nuevo sobre created_at. Auditoría: quitar createdAt de excludeFields y re-anclar SaleAuditTimeline al evento create. Mismo patrón medianoche detectado en quotes.quoteDate, purchase_orders.orderDate, sale_payments.paymentDate, purchase_order_payments.paymentDate y prescriptions.prescriptionDate se registra como deuda técnica sin tocar en este plan.

## Implementation
- Migración drizzle: backfill UPDATE sales SET created_at = (sale_date::date + created_at::time) donde aplique con regla documentada para backfills históricos, luego DROP COLUMN sale_date, DROP INDEX ix_sales_sale_date, CREATE INDEX ix_sales_created_at; idempotente y con conteos antes/después
- Schema src/lib/server/db/schema/sales.ts: eliminar saleDate e índice viejo, exponer createdAt como fecha negocio (mantener defaultNow para override explícito en insert)
- Helper src/lib/dates.ts: composeBusinessTimestamp(dayISO YYYY-MM-DD, submitInstant) compone día form + hora submit en America/Caracas explícito (offset -04:00, sin depender de TZ del servidor) y devuelve ISO UTC; tests unitarios incl. borde 23:30 VET y cambio de día
- Schemas src/lib/schemas/sales.ts: CreateSaleSchema/UpdateSaleSchema conservan campo saleDate como alias dominio con misma validación; specs sales.spec.ts actualizados al alias
- Remotes src/lib/remote/sales.remote.ts (createSale, updateSale header+items) y quotes.remote.ts (conversión quote→venta): mapear alias saleDate → columna createdAt usando composeBusinessTimestamp; updateSale permite editar createdAt; quitar createdAt de excludeFields en auditService.logUpdate
- Queries/UI a createdAt: queries/sales.ts (SaleOrderBy, filtros dateFrom/dateTo, stats), dashboard.ts, receivables.ts, reports.ts, customerHistory.ts, printing.remote.ts, tickera.ts, print/sale/[id]/+page.svelte, SalesTable.svelte, RecentSalesTable.svelte, CustomerSalesHistory.svelte, reports/sales y receivables pages, sales/[id] detalle
- SaleAuditTimeline: reemplazar ancla saleCreatedAt por timestamp del evento create del historial de auditoría en sales/[id]/+page.svelte
- Registrar deuda técnica en PLAN.md: mismo patrón date-only/medianoche en quotes.quoteDate, purchase_orders.orderDate, sale_payments.paymentDate, purchase_order_payments.paymentDate, prescriptions.prescriptionDate (forms con toISODate(nowUTC()), schemas z.iso.date, persistencia a medianoche)
- Verificación: pnpm check, pnpm lint, vitest (sales.spec, tickera.spec, quotes.spec), roundtrip TZ (submit tardío VET conserva día), spot-check ticket impreso muestra hora real, dashboard/reportes filtran por createdAt

## Required Specs
<!-- SPECS_START -->
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- sale-date-truth
<!-- SPECS_END -->