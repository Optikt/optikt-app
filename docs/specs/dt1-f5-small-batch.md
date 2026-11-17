> **Estado:** DONE — trabajo merged; casillas cerradas retroactivamente (verificación 2026-11-17). Spec de aceptación histórica.

# Spec: dt1-f5-small-batch

Scope: feature

# Feature: Splits lote chicos fase 5 (PR #144)

## Objetivo

Bajar 9 archivos 501-601 líneas a orquestadores <300 sin cambiar UX. Lógica verbatim.

## Alcance — Incluido

- `LensCatalogTable` 501→123 + `products/table/` (Row, MobileCard, display)
- `ProductsTable` 575→236 + `products/table/` (Row, MobileCard, display)
- `CurrencyCalculatorModal` 507→166 + `layout/currencyCalc/` (Header, CustomRate, Results, utils)
- `SupplierTreatmentsModal` 519→258 + `suppliers/treatments/` (Row, Create/Edit forms, badges)
- `SaleStep3Summary` 508→201 + `sales/step3/summary/` (5 secciones + viewModel)
- `print/sale/[id]` 508→111 + `sales/print/` (5 secciones + receiptData; CSS a `:global`)
- `brandAccessories.ts` 514→shim + `brandAccessories/` (types/reads/writes/internal)
- `products/[id]/adjustments` 515→250 + `products/adjust/` (6 piezas)
- `lenses/[id]/adjustments` 601→orquestador + `lenses/adjust/` (5 piezas)

## QA

- [x] Tablas lenses/products: desktop/mobile, filtros, badges, costos
- [x] Calculadora: tasa custom, resultados, footer
- [x] Treatments: crear/editar inline, taxable, borrar + confirm
- [x] Step3: descuento global, impuestos, totales = main peso a peso
- [x] Print: ticket idéntico (header, items, pagos, abonos, footer, saltos página)
- [x] Adjusts (products + lenses): entrada/salida, lote, impacto, confirm pérdida
- [x] Accesorios: reglas por marca, overrides, crear/borrar/toggle

## Gates

`pnpm check` 0/0, `pnpm lint`, `pnpm test:unit` 929, bloques 1:1 en 7 splits UI.
