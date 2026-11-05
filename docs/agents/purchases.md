# purchases (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Órdenes de compra a proveedores: wizard (borrador → revisión → confirmación), recepción a inventario vía lotes, pagos multi-moneda, condiciones de crédito (vencimiento) y pronto pago, más sugerencias de precio de venta post-recepción.

## Scope

`components/purchases/**`, `routes/(app)/purchases/**`, `remote/purchaseOrders/**`, `queries/purchaseOrders/**`, `queries/purchaseOrder*.ts` (credit schedule, early payment benefits, payments), `schemas/purchaseOrder*`, `schema/purchaseOrders.ts`; lógica pura `shared/purchaseOrder*` (credit, currencies, payments, rules, lineNumbers).

Owner rules: el factory de pago es de `payments` (leyó también `server/payments/purchasePayments.ts`) con semántica de settlement acá; la recepción escribe en `inventory` (lotes/movimientos) siguiendo las invariantes de ese doc.

## Reglas de dominio / invarianzas

**Máquina de estados** (`shared/enums/purchaseTypes.ts:20-24`, `queries/purchaseOrders/lifecycle.ts:31-171`)

- `DRAFT | CONFIRMED | CANCELLED` (+ sub-estado `isReadyForReview` del draft).
- **Confirmar**: solo desde DRAFT, exige `isReadyForReview=true`, ≥ 1 ítem y **todas las líneas `isReviewed`** — error con conteo faltante. Confirma `confirmedById/confirmedAt`.
- **Cancelar**: solo DRAFT (`lifecycle.ts:150-171`). No hay recepción parcial ni re-apertura post-confirmación.
- **Editar**: solo DRAFT y `!isReadyForReview`; editar resetea el flag; "unmark ready" con `clearReviewed` (`review.remote.ts:71-95`). Guardas centralizadas en `getPurchaseOrderReadinessIssues` (`remote/purchaseOrders/helpers.ts:120-152`) sobre reglas puras `shared/purchaseOrderRules.ts:87-93`.

**Draft**

- `orderNumber` secuencial via `getNextPONumber` dentro de la tx (`orders.ts:53`); líneas numeradas con `assignPurchaseOrderLineNumbers` (`shared/purchaseOrderLineNumbers.ts:5`).
- ⚠️ Los montos de liquidación se **recalculan server-side** desde los ítems (`settlementGrossAmount`, `settlementDebtAmount` con `discountFactor`, y `settlementDebtAmountUsdBcvAtOrder` si liquidación nativa) — `commands.remote.ts:111-141`, `draft.remote.ts:107-137`. El cliente no manda estos montos.
- Guardar draft = **replace completo** de ítems (`replacePurchaseOrderItems`, delete+insert), no diffs.

**Pagos de compra + crédito**

- Solo órdenes CONFIRMED aceptan pagos/beneficios (`payments.remote.ts:48-53,199-204`).
- Normalización central a Bs y USD-BCV: `normalizePurchasePaymentAmounts` (`shared/purchaseOrderPayments.ts`); `specificRate` obligatoria para métodos no-USD/VES (`schemas/purchaseOrderPayments.ts:34-46`).
- Cada pago registra `amountAppliedToDebt` (moneda de liquidación) y `amountAppliedToDebtUsdBcvAtOrder` **proporcional** a la deuda congelada al crear la orden (`server/payments/purchasePayments.ts:157-168`).
- Términos de crédito: `CONTADO` no admite `creditDueDate` ni pronto pago; `CREDIT` lo exige; percent⇔deadline es par inseparable y `deadline ≤ creditDueDate` (`schemas/purchaseOrderCreditSchedule.ts:17-72`).
- Vencimientos: `getUpcomingPurchaseOrderDues` (CONFIRMED + CREDIT + ventana), filtros "pendiente/vencido" ya en SQL (`purchaseOrders/shared.ts:29-56`).
- Void soft (`voidedAt/voidedById`); **anular pago anula en cascada sus beneficios** (`purchasePayments.ts:221-241`) — nunca UPDATE directo (ver doc `payments`).

**Pronto pago (early payment benefits)**

- Guard compartido: `assertProntoPagoTerms` (percent > 0, deadline, `benefitDate ≤ deadline`, `purchasePayments.ts:61-74`).
- Cap = `settlementDebtAmount × percent% − benefitsApplied`, además acotado al `settlementBalance` (tolerancia +0.01).
- ⚠️ Liquidación nativa: el beneficio ligado a pago DEBE traer `amountAppliedToDebt` en la moneda de la orden — sin fallback a USD-BCV (`purchasePayments.ts:136-153`).
- Beneficio retroactivo convierte a USD-BCV con **tasas congeladas de la orden** (`benefitUsdEquivalent`, `:256-265`), no con la tasa del día.

**Monedas / tasas**

- `sourceCurrency: USD | VES | EUR | USDT | PAYPAL`; `settlementCurrency` default = `SOURCE_TO_CURRENCY_CODE[source]` (`shared/purchaseOrderCurrencies.ts:8-23`).
- Normalización a USD-BCV: `sourcePriceToUsdBcv` — USD directo, VES ÷ bcv, EUR/USDT/PAYPAL × sourceRateToVes ÷ bcv (EUR/USDT/PAYPAL exigen `altRate`, `shared/purchaseOrderRules.ts:41-46`).
- ⚠️ Tasas congeladas a la creación: `bcvRate`, `sourceRateToVes`, `settlementDebtAmountUsdBcvAtOrder`.

**Recepción → inventario**

- Confirmar crea **un lote por ítem** con costo neto = `unitPurchasePrice × computeSettlementDiscountFactor` (factor lineal pre-IVA; PERCENT cap 100, AMOUNT cap subtotal; `purchaseOrders/shared.ts:182-204`), con `bcvRateAtPurchase` del lote (`lifecycle.ts:64-84`).
- Escribe movimiento `PURCHASE_IN` referencia `PURCHASE_ORDER` (`lifecycle.ts:92-105`) + incrementa stock en products y lensCatalogItems (`:107-127`).
- `currentPurchasePrice` = siguiente coste FIFO (`getNextFifoCost`); `currentSalePrice` **NO se toca** en la confirmación — el cambio sale como `priceSuggestions` y se aplica por-producto con `applyPriceSuggestionsCmd` (`review.remote.ts:152-176`).

## Patrones locales

- Split DT1: `remote/purchaseOrders/{queries,commands,draft,update,review,finance,payments,helpers}`; queries en `purchaseOrders/{orders,items,lifecycle,shared,types}`.
- Commands = shell: `requireAdmin` + guardas + `db.transaction` + **audit después de la tx** (`payments.remote.ts:74-110`).
- Doble lectura de guardas: Zod `superRefine` **y** re-validación imperativa (`getPurchaseOrderFinanceIssues`) antes de la tx — la UI repite mensajes; no confiar solo en el schema.
- `computePurchaseOrderState` deduplica items+payments+benefits+balance+dueStatus dentro de la tx (`purchasePayments.ts:89-113`).
- Hidratación de listas: `addFinancialMetadata` calcula balance+dueStatus por fila (`shared.ts:106-169`).
- UI: wizard `step1/step2`, `review/`, `draft/` (helpers puros con spec), `detail/` (drawers de crédito/pagos/pronto pago). QA: `docs/specs/po-form-qa.md`, `docs/specs/dt1-f5-money.md`.

## Testing

- Int (harness DT9): `payments.int.spec.ts` (401/400, beneficio en ventana, rejects por deadline/cap, retroactivo, void), `lifecycle.int.spec.ts` (confirm crea lote+stock+movement; rejects not-ready/unreviewed/cancelada). Detalle: `docs/specs/dt9-test-harness.md:21-22`.
- Unit espejo: `schemas/purchaseOrders.spec.ts`, `shared/purchaseOrder{Credit,Currencies,Payments,Rules,LineNumbers}.spec.ts`, specs de componentes draft/review/detail.

## Known gaps / tech debt

- 🟠 Fallback legacy de unidades: pagos/beneficios sin `amountAppliedToDebt` caen a `amountUsdBcv` como deuda nativa (`shared/purchaseOrderCredit.ts:27-28,177`; `purchasePayments.ts:144-146,158`) — en órdenes pre-migración de liquidación nativa mezclaría USD-BCV con moneda local en el balance.
- 🟡 Cálculo de liquidación duplicado inline en `commands.remote.ts:111-135` y `draft.remote.ts:107-137`; y `computeSettlementDiscountFactor` (`shared.ts:182-204`) duplica `getDiscountFactor` (`shared/purchaseOrderCredit.ts:118-140`) — dos fuentes del mismo factor; unificar antes de tocar descuentos.
- 🟡 `applyPriceSuggestionsCmd`: loop de updates+audit sin tx única, con N+1 fuera de tx y cast `as never` (`finance.remote.ts:143-160`).
- 🟡 `getPurchaseOrderDetail` reutiliza `ConfirmPurchaseOrderSchema` como `{id}` prestado (`queries.remote.ts:69`).
- 🟡 Barrels legacy `components/purchases/index.ts` y `purchases/detail/index.ts` — consumibles, no extendibles.
- 🟡 La UI de submit de pagos de compra vive en `components/sales/payments/` (herencia del split F5) — candidata a moverse a `components/purchases/` al unificar pagos (plan pr5).
