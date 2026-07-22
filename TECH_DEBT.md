## Deuda pendiente

### HIGH

1. **Dead code**: `CustomerViewModal`, `SupplierViewModal`, `PrescriptionViewModal`, `PrescriptionFormModal`, `PrescriptionsTable`, `PurchaseCurrencyInput` — exportados pero nunca importados.

2. **`DataTable` vs `DataGrid` duplicados** — Dos implementaciones de tabla con APIs distintas.

3. **Sin integration / E2E tests** para remote functions, queries, flujo completo de pagos/cancelaciones, reportes ni el nuevo flujo óptico del Step 2 (confirmación antes del resumen + autosync del tipo de lente).

4. **Prescripción global para operaciones con múltiples cristales** — El wizard sigue modelando una sola Rx compartida para toda la operación. Hoy se mitiga con advertencias y revisión manual cuando hay múltiples tipos de cristal, pero el soporte real por item/par sigue pendiente.

### LOW

5. **`build/` en el repo** — Debería estar en `.gitignore`.

6. **Duplicación `PurchaseSourceCurrency` vs `CurrencyCode`** — Dos enums con sets de valores que se solapan parcialmente (`USDT`, `VES`), más tres implementaciones de labels/symbols:
   - `purchaseTypes.ts`: `PURCHASE_SOURCE_CURRENCY_LABELS`, `PURCHASE_SOURCE_CURRENCY_SYMBOLS`, `getPurchaseSourceCurrencyLabel/Symbol`, `isAltSourceCurrency`
   - `currencyTypes.ts`: `CURRENCY_LABELS`, `CURRENCY_SYMBOLS`, `getCurrencyLabel`
   - `purchaseOrderCurrencies.ts`: `getSourceCurrencySymbol`, `getSettlementCurrencyLabel`, `getSettlementCurrencySymbol`, `isAltDisplayCurrency` (duplica `isAltSourceCurrency`)
   - **Fix**: Opción B — eliminar helpers redundantes y delegar todo a `currencyTypes.ts`, mantener ambos enums pero con semántica clara.

---

**Prioridad sugerida**: 1) cubrir con E2E el wizard óptico de ventas/presupuestos, y 2) decidir si las operaciones con múltiples cristales se van a soportar de verdad con Rx por item o si se van a restringir.
