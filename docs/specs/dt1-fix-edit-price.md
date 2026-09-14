# Spec: dt1-fix-edit-price

Scope: feature

# Feature: Fix precio edit en EditSaleModal (PR #150)

## Objetivo

Editar solo el precio/cantidad de un ítem existente no persistía: `buildUpdateSalePayload`
omitía `items` y `hasChangesForSale` no lo detectaba (bug preexistente del monolito).

## Alcance — Incluido

- `editSaleDraft.ts`: `signatureForItems` (firma estable, independiente de orden) +
  `haveItemsChanged` (compara contra originales vía `existingItemToInput`).
- `hasChangesForSale` y `buildUpdateSalePayload` aceptan `originalItems` e incluyen
  ediciones in-situ.
- `EditSaleModal.svelte`: pasa `items` originales a ambas funciones.
- `editSaleDraft.spec.ts`: 2 tests nuevos (precio editado → cambios + items incluidos).

## QA

- [ ] Editar solo precio de cristal → botón se activa → guardar → reabrir → precio nuevo

## Gates

`pnpm check` 0/0, `pnpm lint`, spec 22/22, `pnpm test:unit` 931.
