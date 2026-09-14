# Spec: dt1-f5-product-form

Scope: feature

# Feature: Split ProductForm fase 5 (PR #151)

## Objetivo

`ProductForm.svelte` 931→471. `formData` por referencia, binds intactos.

## Alcance — Incluido

- `products/form/`: `productFormClasses.ts`, `pendingEntities.ts`, `productFormTypes.ts`
  (`ProductFormData`), `ProductGeneralSection` + `FrameAttributesFields` +
  `ContactLensFields`, `ProductPricingSection`, `ProductStockSection`,
  `ProductImageSection`, `ProductFormActions`.
- Padre: props, `formData` $state, pending $state, deriveds, 3 `$effect`, instancias
  `createProductForm`/`updateProductForm`, submits, hidden inputs, grid.

## QA

- [ ] Crear: autosku, nombre sugerido (respeta edición), pendientes brand/supplier/material
- [ ] Tipo FRAME→CONTACT cambia atributos y limpia material incompatible
- [ ] Editar: carga valores, validaciones visibles, referencias solo lectura, preview imagen

## Gates

`pnpm check` 0/0, `pnpm lint`, `pnpm test:unit` 929, bloques 22/22.
