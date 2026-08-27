---
plan name: expense-currency
plan description: Unify expense currency with CurrencyCode
plan status: active
---

## Idea

DT16 de PLAN.md. `cashTypes.ts` define `EXPENSE_CURRENCIES` (`USD`/`VES`/`USDT`/`EUR`) con `EXPENSE_CURRENCY_LABELS`/`SYMBOLS` propios — 4ª implementación de moneda que duplica `CurrencyCode` (`USD_BCV`/`EUR_BCV`/`USDT`/`VES`/…) y sus `CURRENCY_LABELS`/`SYMBOLS` + `getCurrencyLabel`/`getCurrencySymbol` (ya canónicos tras DT13). Objetivo: DRY sin migrar datos.

Mapeo: `USD→USD_BCV`, `EUR→EUR_BCV`, `VES→VES`, `USDT→USDT`. Los 3 códigos sobrantes de `CurrencyCode` (`USD_PAYPAL`, `USD_EFECTIVO`, `OTHER`) no existen en gastos.

## Estado actual

- `src/lib/shared/enums/cashTypes.ts`: `ALL_EXPENSE_CURRENCIES`, `EXPENSE_CURRENCY_LABELS`, `EXPENSE_CURRENCY_SYMBOLS`, `isUsdLike`
- Consumidores: `src/routes/(app)/cash/expenses/+page.svelte:762`, `src/lib/shared/expenseCalculations.ts`, `src/lib/schemas/cash.ts:13`, `src/lib/server/db/schema/cashExpenses.ts:36` (`varchar(10)` con `$type<ExpenseCurrency>`)
- `amountUsd` es snapshot inmutable — cambiar display no recalcula filas pasadas

## Implementation

### Opción A — Delegar sin migrar DB (recomendada, ~2h)

1. Añadir `EXPENSE_TO_CURRENCY_CODE: Record<ExpenseCurrency, CurrencyCode>` en `cashTypes.ts` (o `currencyTypes.ts`) con el mapeo arriba
2. Reemplazar `EXPENSE_CURRENCY_LABELS[c]` → `getCurrencyLabel(map[c])` y `EXPENSE_CURRENCY_SYMBOLS[c]` → `getCurrencySymbol(map[c])`; `isUsdLike` → `isBaseCurrency(map[c])`
3. Actualizar 2-3 consumidores: `cash/expenses/+page.svelte`, `expenseCalculations.ts` (`requiresExpenseExchangeRate`, `requiresExpenseRateType`, `getExpenseExchangeRateLabel`), `schemas/cash.ts` si se quiere validar contra subset de `CurrencyCode`
4. Marcar `EXPENSE_CURRENCY_LABELS/SYMBOLS` como `@deprecated` 1 versión, borrar después
5. Sin migración SQL — `cash_expenses.currency` sigue `varchar(10)` con `USD`/`VES`/…

### Opción B — Unificar enum + migrar datos (2d, con riesgo)

1. Cambiar `ExpenseCurrency` → `CurrencyCode` (`ALL_EXPENSE_CURRENCIES` → subset de `CurrencyCode`)
2. Migración `UPDATE cash_expenses SET currency = CASE WHEN currency='USD' THEN 'USD_BCV' WHEN currency='EUR' THEN 'EUR_BCV' ELSE currency END`
3. Rompe si hay reportes externos que esperan `USD` literal; requiere validar `amountUsd` snapshot

## Verificación

- `pnpm check` + `pnpm lint` + `pnpm test:unit`
- Verificar display `VES`/`USDT`/`EUR` en lista de gastos (label `Bs. (Bolívares)` vs `Bs`, `USD (BCV)` vs `USD` — decidir si mantener alias corto)
- `grep -rn EXPENSE_CURRENCY_LABELS` → cero tras delegar

## Archivos

- `src/lib/shared/enums/cashTypes.ts`
- `src/lib/shared/enums/currencyTypes.ts` (si el mapping va allí)
- `src/routes/(app)/cash/expenses/+page.svelte`
- `src/lib/shared/expenseCalculations.ts`
- `src/lib/schemas/cash.ts` (opcional)
