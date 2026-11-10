# payments (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Lógica de dinero transversal a ventas y compras. `src/lib/server/payments/` son **adapters finos** sobre query functions: encapsulan pago + recálculo de saldo + estado derivado, y **el caller es dueño de la transacción** (pasa `executor: DbOrTx`). `src/lib/components/payments/` es UI-adapter pura (paso 1: moneda→método, paso 2: montos/tasas) compartida entre wizard de venta y drawer de compra; el state factory vive en `components/sales/payments/`.

## Scope

`server/payments/**`, `components/payments/**`, lógica pura `shared/payments/**` (strategies, submission).

Owner rules: aquí vive el mecanismo transversal de dinero; las **semánticas por documento** viven en `sales` (venta) y `purchases` (settlement/pronto pago). Si tocas un flujo de pago específico, lee también el doc de ese dominio.

## Reglas de dominio / invarianzas

**Factory y transacciones**

- Todo adapter acepta `executor: DbOrTx` y **nunca abre su propia transacción** (`salePayments.ts:20-24`, `purchasePayments.ts:115-119`). El caller (remote/command) abre `db.transaction()`.
- `submitSalePayment` = `addSalePayment` + `recalcSalePaidAmount` atómicamente (`salePayments.ts:25-43`).
- `submitPurchaseOrderPayment` = pago + beneficio pronto-pago (si aplica) + recompute de balance/dueStatus, mismo `tx` (`purchasePayments.ts:170-217`).
- Audit **después** del commit, nunca dentro de la tx (`addSalePayment.ts:48-50`).

**Venta (moneda de pago vs venta)**

- El monto USD-BCV canónico es el que **ingresa el usuario** (`data.usdBcvAmount`); no recalcular monto×tasa (drift de float, `server/sales/addSalePayment.ts:19-21`).
- Saldos de venta siempre en USD-BCV: `recalcSalePaidAmount` suma `amountBcvUsd` de pagos no anulados.
- `exchangeRate` exigida para métodos no-Bs; void de venta: soft-delete `voidedAt`; venta COMPLETED/READY que queda subpagada revierte estado (tolerancia 0.01).
- ⚠️ **Anulación cascada pago→beneficios (compras) solo existe en el adapter** (`voidPurchaseOrderPayment`), no es trigger de DB — anular siempre vía adapter, nunca con UPDATE directo. Segunda anulación → null → error controlado.

**Compra (settlement currency + pronto pago)**

- El balance **NO se lee de columnas**: se recomputa en memoria desde items + pagos + beneficios (incluyendo voided) via `computePurchaseOrderBalance` (`shared/purchaseOrderCredit.ts`) — `purchasePayments.ts:89-113`. Fuente de verdad = moneda de settlement de la orden.
- Guard server-side dentro de la tx para pronto pago: `percent > 0` + `deadline` + `benefitDate ≤ deadline` (`assertProntoPagoTerms`, `purchasePayments.ts:61-74`); cap con redondeo 2dp; rechazos con tolerancia +0.01.
- ⚠️ Moneda nativa: si `settlementCurrency ≠ USD_BCV`, el beneficio DEBE expresarse en `amountAppliedToDebt` (moneda de la orden); el USD-BCV no cae al cap ni persiste como settlement (`purchasePayments.ts:136-153`).
- Default de deuda: `amountAppliedToDebt = amountUsdBcv`; el "USD BCV al momento de la orden" se prorratea con `settlementDebtAmountUsdBcvAtOrder` congelada (`:158-168,296-304`). Beneficio retroactivo usa **tasas de la orden**, no tasas vivas (`:257-265`).
- `paymentNumber` secuencial por orden (`max+1`, `queries/purchaseOrderPayments.ts:82-92`).
- `getPurchaseOrderPaidAmount` (solo pagos, excluye beneficios) es para caja/legacy — usar `computePurchaseOrderBalance` para saldo real.

**UI adapter (`components/payments/`)**

- Componentes 100% presentacionales: reciben valores derivados y callbacks; **cero cálculo de dinero** (`PaymentAmountCard.svelte:5-61`).
- Selección Moneda → Método con `PAYMENT_CURRENCY_GROUPS`; en settlement nativo el input es monto entregado y el USD-BCV es readonly derivado (`PaymentAmountCard.svelte:91-115`).
- El gate de submit es `PaymentFormModel.canSubmit` (rail + moneda + montos + tasa + referencia + !submitting), `components/sales/payments/paymentFormModel.svelte.ts:47-89`.

## Patrones locales

- Adapter = composición de query fns + validaciones de negocio + recompute, con tx del caller. Errores de negocio = `throw new Error(mensaje español)` → caller traduce a toast.
- Máquina de modales de compra: `PurchaseFlowState` (sobrepago/pronto-pago) con callbacks inyectados y snapshot inmutable (`paymentFormModel.svelte.ts:203-256`).

## Testing

- Adapters: `server/payments/purchasePayments.int.spec.ts` (DB real: amortización nativa, void, cap, ventana de fecha, guard moneda nativa).
- Flujos de venta: `server/sales/addSalePayment.int.spec.ts`, `voidSalePayment.int.spec.ts` (recalc, reabrir COMPLETED→PENDING, cross-sale).
- Fns puras: `paymentFormValues.spec.ts`, `paymentFormCalculations.spec.ts`, `purchaseOrderPayments.spec.ts`.
- E2E (plan pr5): `e2e/sale-payment.test.ts`, `e2e/purchase-payment.test.ts`, `e2e/quote-to-sale.test.ts` — `workers: 1` (`playwright.config.ts:11`).

## Known gaps / tech debt

- 🟠 Plan `docs/plans/pr5-payment-factory.md` activo: hecho el split del form; pendiente `paymentFormModel.svelte.spec.ts` y specs de las ~20 fns derivadas (`docs/specs/pr5-payment-factory.md:43-45`).
- 🟡 `voidSalePayment` de venta **no persiste `voidedById`** (asimetría con compras, `queries/sales/payments.ts:76-79` vs `queries/purchaseOrderPayments.ts:116-120`).
- 🟡 `getPurchaseOrderPaidAmount` convive con `computePurchaseOrderBalance` — código nuevo que calcule saldo debe usar el segundo.
- 🟡 `components/payments/index.ts` es barrel — contra la política No Barrels; consumible, no extendible.
- 🟡 `.spec.ts` de `purchaseOrderPayments` vive en `db/queries/` pero testea fns de `src/lib/shared/` — placement mismatch a corregir al refactor.
