---
name: Optikt money & rates
description: Reglas de dinero, tasas BCV y pagos en Optikt. Usar SIEMPRE al tocar precios, descuentos, impuestos, subtotales, tasas de cambio, pagos (mixtos, en Bs o USD), créditos o abonos en ventas, compras y gastos.
---

# Dinero y tasas (Optikt)

Regla base: **todo cálculo monetario reusa un módulo existente**. Nunca reimplementes una fórmula ni inventes un redondeo nuevo.

## Fuentes únicas

| Qué | Dónde |
| --- | --- |
| Totales de documento | `src/lib/shared/saleTotals.ts` → `computeSaleTotals`, `computeDocumentTotals` |
| Impuesto (IVA) | `src/lib/shared/tax.ts` → `decomposePrice`, `computeTaxBreakdown`, `DEFAULT_TAX_RATE` |
| Formato de montos | `src/lib/utils/format.ts` → `formatPrice`, `formatCurrency`, `formatCompactPrice` |
| Descuentos | `src/lib/utils/format.ts` → `computeDiscount`, `getDiscountValueMax`, `clampDiscountValue` |
| Estrategia por método de pago | `src/lib/shared/payments/strategies.ts` → `PAYMENT_METHOD_STRATEGIES`, `getPaymentMethodStrategy` |
| Moneda según el medio | `src/lib/shared/enums/paymentMethods.ts` → `PAYMENT_METHOD_CURRENCY`, `rateTypeForRail`, `isBsPaymentMethod` |
| Tasa congelada del ticket | `src/lib/shared/ticketRate.ts` → `resolveTicketRate` |
| Tasas live | `src/lib/server/exchangeRates/service.ts` → `getExchangeRateValue`, `getCachedExchangeRateValue`, `roundExchangeRate` |

## Invariantes

1. **La tasa se congela al confirmar, no al imprimir.** `sales.snapshotBcvRate` (`src/lib/server/db/schema/sales.ts`) se escribe en `src/lib/server/sales/createSale.ts` y en `src/lib/server/quotes/convertQuoteToSale.ts`. Un `null` significa venta anterior a la feature (legacy) — **no** es una señal de "recalcular".
2. **Imprimir solo lee**: `resolveTicketRate(snapshotBcvRate, liveBcvRate)` — el snapshot siempre gana. Un reprint no escribe tasa.
3. **Un pago = una transacción.** `submitSalePayment` (`src/lib/server/payments/salePayments.ts`) recibe `tx` y ejecuta `addSalePayment` + `recalcSalePaidAmount` dentro del mismo `db.transaction()` (patrón en `src/lib/server/sales/addSalePayment.ts`). El audit log va **después** del commit.
4. **Redondeo único y al final.** Tasas a 2 decimales (`roundExchangeRate`); montos a 2 (`Number(value.toFixed(2))`). No introduzcas precisión de 3+ decimales en un monto.
5. **Bs vs USD se decide por la estrategia del método**, no por heurística sobre el número.

## Deuda conocida: no la empeores

`roundCurrency` está copiado en ≥5 módulos:

- `src/lib/components/sales/paymentFormCalculations.ts:19`
- `src/lib/server/db/queries/purchaseOrders/shared.ts:171`
- `src/lib/shared/purchaseOrderPayments.ts:22`
- `src/lib/shared/purchaseOrderCredit.ts:91`
- `src/lib/shared/expenseCalculations.ts:12`

No añadas una sexta copia: importa la del mismo layer o propón consolidar en `src/lib/shared/`.

## Prueba mínima

```sh
pnpm exec vitest --run --project=server \
  src/lib/shared/saleTotals.spec.ts \
  src/lib/shared/tax.test.ts \
  src/lib/shared/ticketRate.spec.ts
```

Con base de datos (Docker, testcontainers): `pnpm test:integration`.
Specs de dinero/pagos: `addSalePayment.int.spec.ts`, `voidSalePayment.int.spec.ts`, `payments/purchasePayments.int.spec.ts`, `remote/sales/payments.int.spec.ts`.

## Checklist antes de dar por cerrado un cambio de dinero

- [ ] ¿Reusé el módulo compartido en lugar de reescribir la fórmula?
- [ ] ¿Todas las escrituras relacionadas están en un solo `db.transaction()` con `tx` propagado?
- [ ] ¿La tasa que se guarda es la del momento de confirmar?
- [ ] ¿Añadí una prueba que falla sin el fix?
- [ ] ¿El redondeo ocurre una sola vez, al final?
