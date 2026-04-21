## Deuda pendiente

### HIGH

1. **Flowbite sigue presente en rutas activas y shared UI** — Además de páginas legacy, los flujos activos de ventas/presupuestos siguen usando `flowbite-svelte` en piezas compartidas como `PrescriptionInput` y `PrescriptionValidationModal`, además de wrappers UI (`FormInput`, `BaseSelect`, `ConfirmModal`, `DataTable`, etc.). El objetivo de un único sistema visual todavía no se cumple.

### MEDIUM

2. **Dead code**: `CustomerViewModal`, `SupplierViewModal`, `PrescriptionViewModal`, `PrescriptionFormModal`, `PrescriptionsTable`, `PurchaseCurrencyInput` — exportados pero nunca importados.

3. **`DataTable` vs `DataGrid` duplicados** — Dos implementaciones de tabla con APIs distintas.

4. **Sin integration / E2E tests** para remote functions, queries, flujo completo de pagos/cancelaciones, reportes ni el nuevo flujo óptico del Step 2 (confirmación antes del resumen + autosync del tipo de lente).

5. **Prescripción global para operaciones con múltiples cristales** — El wizard sigue modelando una sola Rx compartida para toda la operación. Hoy se mitiga con advertencias y revisión manual cuando hay múltiples tipos de cristal, pero el soporte real por item/par sigue pendiente.

### LOW

6. **`build/` en el repo** — Debería estar en `.gitignore`.

---

**Prioridad sugerida**: 1) terminar de sacar `flowbite-svelte` de los flujos activos/shared UI, 2) cubrir con E2E el wizard óptico de ventas/presupuestos, y 3) decidir si las operaciones con múltiples cristales se van a soportar de verdad con Rx por item o si se van a restringir.
