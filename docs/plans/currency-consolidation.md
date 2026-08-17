---
plan name: currency-consolidation
plan description: Consolidate duplicated currency helpers
plan status: active
---

## Idea

`DT13` de PLAN.md. La auditoría (2026-08-17) redujo el alcance real: menos duplicación viva de lo que decía el análisis original, pero hay 7 helpers muertos + 1 duplicación viva (`getSettlementCurrencySymbol` vs `CURRENCY_SYMBOLS`).

**Fuera de scope:** `EXPENSE_CURRENCY_*` de `cashTypes.ts` → nuevo DT16 en PLAN.md.

## Estado actual

**Vivo — duplicación real:**
- `getSettlementCurrencySymbol` (purchaseOrderCurrencies.ts) — 12 consumidores. **Nota: las tablas NO son idénticas** — difieren en USDT (`'USDT'` vs `'$'`), VES (`'Bs'` vs `'Bs.'`) y USD_EFECTIVO (`'¤'` default vs `'$'`). Estrategia: alinear `CURRENCY_SYMBOLS` a los valores de settlement (USDT→`'USDT'`, VES→`'Bs'`, USD_EFECTIVO→`'$'`) — `CURRENCY_SYMBOLS` no tiene consumidores externos, cero colateral. Resultado: los 12 consumidores no ven ningún cambio visible salvo USD_EFECTIVO `'¤'`→`'$'` (mejora).
- `getSourceCurrencySymbol` (purchaseOrderCurrencies.ts) — 13 consumidores; se queda como el único helper de símbolos de `PurchaseSourceCurrency`.

**Muerto (cero imports, solo self-referencias):**
- purchaseTypes.ts: `PURCHASE_SOURCE_CURRENCY_LABELS`, `PURCHASE_SOURCE_CURRENCY_SYMBOLS`, `getPurchaseSourceCurrencyLabel`, `getPurchaseSourceCurrencySymbol`, `isAltSourceCurrency`
- purchaseOrderCurrencies.ts: `getSettlementCurrencyLabel`, `isAltDisplayCurrency`

**Core sano (no tocar):** `SOURCE_TO_CURRENCY_CODE`, `CURRENCY_CODE_TO_SOURCE`, `sourcePriceToUsdBcv`, `sourceCurrencyRequiresRateToVes`, `getCurrencyLabel`, `CURRENCY_LABELS`, `CURRENCY_SYMBOLS`.

## Implementation

1. **Fase 1 — matar dead code:**
   - `src/lib/shared/enums/purchaseTypes.ts`: borrar `PURCHASE_SOURCE_CURRENCY_LABELS`, `PURCHASE_SOURCE_CURRENCY_SYMBOLS`, `getPurchaseSourceCurrencyLabel`, `getPurchaseSourceCurrencySymbol`, `isAltSourceCurrency`
   - `src/lib/shared/purchaseOrderCurrencies.ts`: borrar `getSettlementCurrencyLabel`, `isAltDisplayCurrency`; limpiar el doc comment que las menciona
2. **Fase 2 — unificar símbolos vivos:**
   - `src/lib/shared/enums/currencyTypes.ts`: alinear `CURRENCY_SYMBOLS` (USDT→`'USDT'`, VES→`'Bs'`, USD_EFECTIVO→`'$'`) + nuevo `getCurrencySymbol(code: string): string` → `CURRENCY_SYMBOLS[code] ?? '¤'`
   - Borrar `getSettlementCurrencySymbol` de purchaseOrderCurrencies.ts
   - Migrar los 12 consumidores a `getCurrencySymbol` (import desde `$lib/shared/enums`)
3. **Verificación de paridad:** script que assert el output de `getSettlementCurrencySymbol` == `getCurrencySymbol` para todo `CurrencyCode` (tras alinear) → cero cambio visual salvo USD_EFECTIVO
4. **Verificar:** `pnpm check` + `pnpm lint` + `pnpm test:unit`

## Archivos

- `src/lib/shared/enums/purchaseTypes.ts`
- `src/lib/shared/enums/currencyTypes.ts`
- `src/lib/shared/purchaseOrderCurrencies.ts`
- 12 consumidores: `PurchaseOrderOverviewCard`, `PurchaseOrderItemsList`, `PurchaseOrderStep2`, `ItemsContextHeader`, `purchaseOrderDetail.ts`, `purchases/[id]/+page.svelte`, etc.