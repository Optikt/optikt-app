# Spec: dt1-payment-strategy

Scope: repo

# DT1 · Payment Method Strategy + Domain Adapters

## Problema

- `PaymentForm.svelte:333-410` referenceConfig switch por método; `:390-415` nativeLabel/nativePrefix switches; derivaciones rate/currency repartidas.
- Lógica de método duplicada entre ventas y compras (`PAYMENT_RAILS_BY_CURRENCY` vs `SALES_RAILS_BY_CURRENCY` en `paymentMethods.ts`).
- Probar el form = instanciar 1076 líneas. Test unitario imposible.
- `sales.remote.ts` (`addSalePayment`/`voidSalePayment`) y `purchaseOrders.remote.ts` (`addPurchaseOrderPaymentCmd`/`voidPurchaseOrderPaymentCmd`) comparten shape conceptual pero no contrato común.

## Solución (Strategy)

1. `src/lib/shared/payments/strategies.ts`:
   - `ReferenceConfig { label, required, placeholder, helper, fallbackValue? }`
   - `PaymentMethodStrategy { method, label, currency, rateType, referenceConfig, nativeLabel, nativePrefix, requiresSpecificRate, railsPerCurrency }`
   - `PAYMENT_METHOD_STRATEGIES: Record<PaymentMethod, PaymentMethodStrategy>` + `getPaymentMethodStrategy(method)`
   - Registry consolida: `PAYMENT_METHOD_CURRENCY`, `requiresPaymentMethodSpecificRate`, `rateTypeForRail`, referenceConfig switch, native label/prefix, rails por moneda (sales/purchase derivados del mismo registry).
2. Migración: PaymentForm consume strategy (zero switches). Rails venta/compra se derivan del registry con contexto de dominio.

## Solución (Adapter de dominio)

1. `src/lib/shared/payments/submission.ts`:
   - `PaymentSubmissionInput { domain: 'sale'|'purchase', amount, method, currency, rate, reference, metadata }`
   - `PaymentSubmissionResult { success, paymentId, balanceAfter }`
2. `src/lib/server/payments/`:
   - `SalePaymentAdapter`: submission → `addSalePayment` + `recalcSalePaidAmount` (db.transaction, patrón AGENTS.md)
   - `PurchasePaymentAdapter`: submission → `addPurchaseOrderPayment` + recalculo crédito/saldos
3. Beneficio: UI único de pago; lógica under the hood por dominio. DT9 testea adapters con executor double.

## UI decomposition (después del registry)

`PaymentForm.svelte` (1076) → `components/payments/`:
- `PaymentMethodPills.svelte` (ya existe, reusar)
- `PaymentReferenceInput.svelte` — consume `referenceConfig` del strategy
- `PaymentAmountCard.svelte` — nativeLabel/nativePrefix/currency del strategy
- `PaymentConversionCard.svelte` — rate/BCV display
- `PaymentsContext` (`src/lib/context/payments.ts`): balance, pendingAmount, selección — elimina prop drilling entre cards
- Orquestador PaymentForm ≤300 líneas

## Tests

- `strategies.spec.ts`: data-driven por método — currency, rateType, referenceConfig, rails.
- `submission.spec.ts`: mapeo adapters con executor double — sale/purchase.
- Componentes: spec de contexto puro (no UI) + QA manual del flujo de pago venta/compra.

## Gate de aceptación

- Cero `case PaymentMethod` switches en PaymentForm.svelte.
- Agregar método de pago nuevo = 1 entrada registry + tests, sin tocar UI ni remotes.