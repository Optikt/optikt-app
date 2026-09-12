---
plan name: dt1-t2-purchases
plan description: Descomponer purchase form T2
plan status: active
---

## Idea
Descomponer `src/lib/components/purchases/NewPurchaseOrderForm.svelte` (1003 líneas) con patrón orquestador: formulario ~495 + 4 secciones en `purchases/review/` (PurchaseStep1Section, PurchaseReviewItems, PurchaseReviewSummary, PurchaseWizardNav, PurchaseOrderModals) + `purchaseReview.ts` puro (títulos, validación de pasos, payloads, warnings, elegibilidad) con spec espejo. Cero cambios UX. Remotes create/saveDraft, guards reactivos y effects intactos en el orquestador.

## Implementation
- Crear rama chore/dt1-t2-po-form y mapear wizard
- Extraer purchaseReview.ts puro + spec espejo
- Crear secciones review (step1, items, summary, nav, modals) y cablear
- Podar orquestador bajo 500 con validación y payloads en helpers
- Gates check/lint/test + size gate + plan/spec docs + QA + PR

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt1-split-protocol
- dt1-payment-strategy
- public-catalog-arch
- sale-subtotal-semantics
- po-form-qa
<!-- SPECS_END -->