---
plan name: dt1-t2-purchdetail
plan description: Descomponer purchase detail T2
plan status: active
---

## Idea
Descomponer `src/routes/(app)/purchases/[id]/+page.svelte` (621 líneas) ya parcialmente componentizada: extraer `detail/purchaseDetail.ts` puro (view-model de resumen, mensajes, revert target, toggle optimista) con spec espejo + `detail/PurchaseOrderModals.svelte` (7 modales) + `detail/PurchaseOrderDrawers.svelte` (3 drawers). Contexto `purchaseOrderDetail` intacto (misma interface, getters desde view-model). Remotes de escritura intactos en el orquestador. Cero cambios UX.

## Implementation
- Crear rama chore/dt1-t2-po-detail y mapear handlers/modales
- Extraer purchaseDetail.ts puro + spec espejo
- Crear PurchaseOrderModals y PurchaseOrderDrawers y cablear
- Podar página bajo 500 con view-model y props inline
- Gates check/lint/test + size gate + plan/spec docs + QA + PR

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt1-split-protocol
- dt1-payment-strategy
- public-catalog-arch
- sale-subtotal-semantics
- purchdetail-qa
<!-- SPECS_END -->