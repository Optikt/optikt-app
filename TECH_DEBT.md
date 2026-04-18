## Auditoría pre-producción

### BLOCKERS (arreglar antes de usar)

1. **Remote functions sin auth guards** — 17 de 20 archivos remote (`sales`, `brands`, `customers`, `purchaseOrders`, etc.) no tienen `requireAuth()`. El layout guard solo protege carga de páginas, no invocaciones directas de remote functions. Un atacante podría invocar endpoints de escritura sin sesión.

2. **`updateSettingsForm` sin protección** — Cualquiera podría modificar la configuración del negocio.

### HIGH (arreglar pronto)

3. **Config page rota** — Hay un `<!-- FIXME: Settings is always null here -->` en `/config`. La funcionalidad de configuración del negocio nunca se renderiza.

4. **Tasa BCV no se persiste por venta** — El detalle de venta usa la tasa más reciente en vez de la histórica. Si la tasa BCV cambia, los reportes de ventas anteriores mostrarán montos incorrectos en bolívares.

5. **50+ archivos aún importan flowbite-svelte** — No solo las 4 páginas legacy, sino también wrappers UI (`FormInput`, `BaseSelect`, `ConfirmModal`, `DataTable`, etc.) y componentes de dominio (modals, forms, `PrescriptionInput`, `ReportHeader`). Son dos sistemas de UI paralelos.

### MEDIUM (deuda técnica)

6. **Dead code**: `CustomerViewModal`, `SupplierViewModal`, `PrescriptionViewModal`, `PrescriptionFormModal`, `PrescriptionsTable`, `PurchaseCurrencyInput` — exportados pero nunca importados.

7. **IVA 16% hardcoded en 8 archivos** — Si el IVA cambia, hay que tocar 8 archivos. Debería ser `DEFAULT_TAX_RATE = 16`.

8. **`DataTable` vs `DataGrid` duplicados** — Dos implementaciones de tabla con APIs distintas.

9. **build en el repo** — Debería estar en .gitignore.

10. **Sin integration tests** para remote functions, queries, flujo completo de pagos/cancelaciones ni reportes.

### Lo que está bien

- 0 errores de tipo, 0 warnings de svelte-check
- Lint limpio
- SQL parametrizado (sin riesgos de injection)
- `console.log` solo en seeds
- Migraciones en buen estado

---

**Mi recomendación**: Los **blockers de auth** (1 y 2) son lo único que yo arreglaría antes de empezar a usar la app. Es agregar `requireAuth()` a las remote functions de escritura. El resto es deuda que se puede ir pagando mientras la usan. ¿Quieres que arregle los auth guards?