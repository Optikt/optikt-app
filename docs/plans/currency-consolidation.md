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
- `getSettlementCurrencySymbol` (purchaseOrderCurrencies.ts) — 12 consumidores; tabla idéntica a `CURRENCY_SYMBOLS` (currencyTypes.ts). Verificar paridad por script antes de migrar.
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
   - `src/lib/shared/enums/currencyTypes.ts`: nuevo `getCurrencySymbol(code: string): string` → `CURRENCY_SYMBOLS[code] ?? '¤'`
   - Borrar `getSettlementCurrencySymbol` de purchaseOrderCurrencies.ts
   - Migrar los 12 consumidores a `getCurrencySymbol` (import desde `$lib/shared/enums`)
3. **Verificación de paridad (antes de cambiar imports):** script que assert `getSettlementCurrencySymbol(c) === CURRENCY_SYMBOLS[c]` para todo `CurrencyCode` → cero cambio visual garantizado
4. **Verificar:** `pnpm check` + `pnpm lint` + `pnpm test:unit`

## Archivos

- `src/lib/shared/enums/purchaseTypes.ts`
- `src/lib/shared/enums/currencyTypes.ts`
- `src/lib/shared/purchaseOrderCurrencies.ts`
- 12 consumidores: `PurchaseOrderOverviewCard`, `PurchaseOrderItemsList`, `PurchaseOrderStep2`, `ItemsContextHeader`, `purchaseOrderDetail.ts`, `purchases/[id]/+page.svelte`, etc.