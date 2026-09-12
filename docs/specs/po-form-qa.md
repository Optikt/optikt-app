# Spec: po-form-qa

Scope: feature

# Feature: Aceptación split purchase form T2

Scope: feature
Vinculado a: dt1-t2-purchases

## Objetivo

Descomponer `NewPurchaseOrderForm.svelte` sin cambiar el wizard de compras.

## Alcance — Incluido

- 5 secciones en `purchases/review/` + `purchaseReview.ts` puro con spec espejo.
- Remotes `createPurchaseOrderCmd`/`savePurchaseOrderDraftCmd`, guards y effects intactos.

## QA — Compras

- [ ] Paso 1: validación por campo; cambio proveedor/doctype con items pide confirmar/limpiar
- [ ] Cambio moneda con items pide confirmar y limpia precios; sync de tasa alt recalcula
- [ ] Paso 2: agregar items; paso 3: lista + resumen + margen cuadran
- [ ] Guardar sin warnings crea; con warnings abre modal; edit guarda borrador y navega
- [ ] Navegación wizard bloqueada sin validez; Cancelar/Atrás correctos

## Gates

`pnpm check` 0, `pnpm lint`, `pnpm test:unit`, size sin FAIL en scope, `rg` cero imports rotos.
