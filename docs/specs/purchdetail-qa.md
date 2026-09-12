# Spec: purchdetail-qa

Scope: feature

# Feature: Aceptación split purchase detail T2

Scope: feature
Vinculado a: dt1-t2-purchdetail

## Objetivo

Adelgazar `purchases/[id]/+page.svelte` sin cambiar el detalle de compra ni su contexto.

## Alcance — Incluido

- `detail/purchaseDetail.ts` puro con spec espejo + `PurchaseOrderModals` + `PurchaseOrderDrawers`.
- Contexto `purchaseOrderDetail` con la misma interface; remotes de escritura intactos.

## QA — Compra detalle

- [ ] Header, overview, items, movimientos, aside cuadran con main
- [ ] Confirmar (con/sin sugerencias), confirmar+pagar (composer precargado), ready/unready, cancelar
- [ ] Toggle reviewed optimista con rollback; revert lote con modal y motivo
- [ ] Precios sugeridos aplicar/omitir; pagos drawers e historial; auditoría
- [ ] Draft banner y columna revisión solo en borrador listo

## Gates

`pnpm check` 0, `pnpm lint`, `pnpm test:unit`, size sin FAIL en scope, `rg` cero imports rotos.
