# Spec: dt1-f5-money

Scope: feature

# Feature: Splits dinero fase 5 (PR #149)

## Objetivo

`SaleItemsTable` 885→246 y `PaymentForm` 850→518 (excepción ≤520 aceptada). Dinero verbatim.

## Alcance — Incluido

- `sales/itemsTable/`: `itemDisplay.ts`, `costTotals.ts`, `SaleItemsRow`, `CostEditForm` (binds),
  `LensRxPanel`, `TreatmentSubRow`, `ItemsTableFooter`, `EnrichItemModal` (binds).
  `saveEdit`/`saveEnrich` (remotes + toast) quedan en el padre.
- `sales/payments/`: `paymentFormDerived.ts` (20 fns puras), `paymentFormSelection.svelte.ts`
  (clase con `$state`: reset/selection/effects-inputs), `purchasePayment.ts` (submit purchase +
  `createPurchaseSubmitApi`), `salePaymentSubmit.ts`, `PurchasePaymentModals`,
  `PaymentRailSection`, `PaymentFormProps` movido a derived.
- `PaymentComposerRequest` movido a `paymentFormDerived` (drawer actualizado).
- Payloads `addPayment`/`buildPurchasePayload` verificados campo por campo.

## QA

- [ ] Items: expandir receta, editar costos, completar/editar ítem libre, footer = main
- [ ] Pagos sale: cada rail, Cashea, sobrepago, Finalizar vs Aplicar
- [ ] Pagos purchase: tasa específica, pronto pago aplicar/anotar, sobrepago modal, liquidación

## Gates

`pnpm check` 0/0, `pnpm lint`, `pnpm test:unit` 929, bloques 34/34 + 7/7.
