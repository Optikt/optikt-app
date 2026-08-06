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

7. **Carga anticipada de todos los productos y lentes en SSR para wizard de compras** (`/purchases/new`)
   - **Problema**: La función `load` de la página trae TODOS los productos y cristales disponibles en la base de datos sin filtrar por proveedor. Esto es ineficiente: el proveedor se selecciona en Step 1 pero los datos se cargan antes de saber cuál es. Con cientos/miles de productos, el payload SSR crece innecesariamente y la búsqueda cliente-side escanea registros que nunca se usarán.
   - **Impacto**: Memoria y tiempo de fetch SSR innecesarios. La búsqueda cliente-side filtra localmente, lo cual escala mal con muchos productos.
   - **Solución propuesta**:
     - Opción A (simple): Al validar Step 1 y pasar a Step 2, fetchear productos del proveedor vía endpoint `/api/products?supplierId=X` usando SvelteKit `fetch` en el cliente. El `load` SSR dejaría de traer productos/lentes.
     - Opción B (ideal): Endpoint de búsqueda server-side (`/api/products/search?supplierId=X&q=texto`) que el combobox consulta en tiempo real al escribir, eliminando la carga completa.
     - Recomendación: implementar Opción A primero (menos cambios), luego migrar a Opción B si se necesita búsqueda más eficiente.
   - **Archivos afectados**: `src/routes/(app)/purchases/new/+page.server.ts`, `src/routes/(app)/purchases/new/+page.svelte`, `src/lib/components/purchases/step2/PurchaseOrderStep2.svelte`

8. **Slide-over de pagos en ventas no soporta conversión dual de moneda**
   - **Problema**: En el módulo de ventas, al registrar un pago en una moneda distinta a USD BCV (ej. bolívares, USDT), el slide-over no permite ver la equivalencia entre la moneda de pago y USD BCV en tiempo real. El usuario debe calcular la conversión manualmente.
   - **Solución propuesta**: Modificar el slide-over de pagos para mostrar dos inputs vinculados cuando se usa moneda distinta: monto en moneda de pago y su equivalente en USD BCV calculado con la tasa del día (o la tasa ingresada en la orden). Esto reduce errores de cálculo y acelera el registro de pagos.
   - **Archivos afectados**: Componentes de slide-over de pagos en `src/lib/components/sales/`, lógica de tasas en `src/lib/shared/purchaseOrderCurrencies.ts`.
   - **Nota**: Totalmente fuera del scope del módulo de compras. Abordar en una sesión dedicada a ventas.

**Prioridad sugerida**: 1) cubrir con E2E el wizard óptico de ventas/presupuestos, y 2) decidir si las operaciones con múltiples cristales se van a soportar de verdad con Rx por item o si se van a restringir.
