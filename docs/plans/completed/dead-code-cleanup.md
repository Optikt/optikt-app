---
plan name: dead-code-cleanup
plan description: Remove unused components and exports
plan status: done
---

## Idea

`DT11` de PLAN.md: 5 componentes muertos con cero imports (verificado con rg, 2026-08-16). `SupplierViewModal` quedó fuera de la lista — sí se usa en `SuppliersTable.svelte`.

**Lista final:**
- `CustomerViewModal` — exportado solo en `customers/index.ts:3`
- `PrescriptionViewModal` — exportado solo en `prescriptions/index.ts:5`
- `PrescriptionFormModal` — exportado solo en `prescriptions/index.ts:4`
- `PrescriptionsTable` — exportado solo en `prescriptions/index.ts:6`
- `PurchaseCurrencyInput` — **huérfano total** (ni barrel export; 6905 bytes)

Cero `*.spec.ts` referencian alguno. Riesgo de eliminación nulo (git history recupera).

## Implementation

1. Eliminar los 5 archivos:
   - `src/lib/components/customers/CustomerViewModal.svelte`
   - `src/lib/components/prescriptions/PrescriptionViewModal.svelte`
   - `src/lib/components/prescriptions/PrescriptionFormModal.svelte`
   - `src/lib/components/prescriptions/PrescriptionsTable.svelte`
   - `src/lib/components/ui/PurchaseCurrencyInput.svelte`
2. Limpiar barrels:
   - `customers/index.ts` línea 3
   - `prescriptions/index.ts` líneas 4-6
3. Re-verificar con `rg` que nada referencie los nombres (incluye imports wildcard `* as`)
4. Verificar: `pnpm check` + `pnpm lint` + `pnpm test:unit`

## Verificación

- `rg -l "CustomerViewModal|PrescriptionViewModal|PrescriptionFormModal|PrescriptionsTable|PurchaseCurrencyInput" src` → solo resultados en git history, cero en working tree
- `pnpm check` 0 errores, `pnpm lint` limpio