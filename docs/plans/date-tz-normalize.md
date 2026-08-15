---
plan name: date-tz-normalize
plan description: Unify date storage and timezone
plan status: done
---

## Idea
Normalizar semántica de fechas en todo el codebase. Dos problemas: (1) el módulo cash es el único que usa z.iso.datetime() para un campo calendario (expenseDate) — el form fabrica 'T12:00:00.000Z' y el reembolso automático guarda el instante real, creando datos mixtos; la hora jamás se muestra en UI y el instante real ya vive en sales.refundedAt, así que datetime es metadata muerta. (2) La sesión de DB no fija timezone: el postgres local corre America/Caracas mientras el de prod corre UTC, así que un mismo write date-only 'YYYY-MM-DD' se guarda como 00:00Z o 04:00Z según ambiente (verificado: 60 filas sale_date a hora 0 UTC, 2 a hora 4), y las lecturas drizzle devuelven strings con offset de sesión ('-04') que rompen slice(0,10) — la UI local muestra el día anterior para filas escritas en UTC. Solución: fijar TimeZone=UTC en la conexión postgres-js (verificado empíricamente con connection.timezone), convertir expenseDate a date-only con toISODate(nowUTC()) (día local, igual que PaymentForm), refinar los writes date-only de alcance 2 (quotes.remote, lenses.remote) de now.slice(0,10) a toISODate(nowUTC()), y migrar las filas existentes de columnas date-only a medianoche UTC de su día UTC (idempotente).

## Implementation
- Fijar TimeZone=UTC en la conexión: src/lib/server/db/index.ts — postgres(DATABASE_URL, { connection: { timezone: 'UTC' } }) (verificado: startup param funciona, drizzle devuelve '2026-08-08 00:00:00+00'). Verificar roundtrip lectura/escritura.
- expenseDate → date-only (scope 3): src/lib/schemas/cash.ts:37 z.iso.datetime() → z.iso.date(); src/routes/(app)/cash/expenses/+page.svelte:146 eliminar concat T12:00:00.000Z y enviar form.expenseDate directo; actualizar fixture en src/lib/schemas/cash.spec.ts:10 a '2025-05-15'.
- Path reembolso: src/lib/remote/sales.remote.ts:754 — expenseDate: now → expenseDate: toISODate(nowUTC()) (día local, convención PaymentForm). Importar toISODate desde $lib/dates si no está.
- Refinar alcance 2 a día local: src/lib/remote/quotes.remote.ts:672 saleDate: now.slice(0, 10) → toISODate(nowUTC()); src/lib/remote/lenses.remote.ts:822 orderDate: now.slice(0, 10) → toISODate(nowUTC()). Importar toISODate en ambos.
- Migración de datos (idempotente): para columnas date-only — sales.sale_date, sale_payments.payment_date, purchase_orders.order_date, cash_expenses.expense_date, purchase_order_payments.payment_date, quotes.quote_date, quotes.valid_until, prescriptions.prescription_date, customers.birth_date — ejecutar UPDATE SET col = date_trunc('day', col AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' WHERE col IS NOT NULL AND col <> date_trunc('day', col AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'. Local: 2 filas en sales.sale_date. Verificar conteo antes/después.
- Verificación: pnpm check; vitest (cash.spec, sales.spec, quotes.spec, purchaseOrders.spec, purchaseOrderCreditSchedule.spec); roundtrip lectura con TZ fija (slice(0,10) == día esperado); spot-check UI sales/cash muestran fecha correcta. NO tocar timestamps reales (created_at, completed_at, refunded_at, etc.).

## Required Specs
<!-- SPECS_START -->
- backup-infra-sec
- public-catalog-arch
<!-- SPECS_END -->