---
plan name: dt1-t2-sales
plan description: Descomponer sales detail T2
plan status: active
---

## Idea
Descomponer `src/routes/(app)/sales/[id]/+page.svelte` (792 líneas) con el patrón orquestador validado en fase 3: página ~300 líneas + 6 secciones en `src/lib/components/sales/detail/` + helpers puros en `saleDetail.ts` con spec espejo. Cero cambios UX. Secciones: SaleDetailHeader (back + título + 3 grupos de acciones), SaleDetailNotices (notas, cancelación/reembolso, aviso free items), SaleDetailCustomerCard (cliente/vendedor/orden/fecha/estado), SaleDetailSummary (totales + saldo + progreso + botón cobrar), SaleDetailPayments (lista de abonos Bs/USDT/efectivo), SalePaymentDrawer (SlideOver + PaymentForm). Wiring de modales (Edit, Cancel, Status, Stock, PDF, Audit) queda en la página. Helpers: customerName, customerIdNumber, refundCardClasses, refundDecisionTitle, nextStatusTargets (presets post-pago).

## Implementation
- Crear rama chore/dt1-t2-sale-detail desde main y verificar gates base (check/lint/test)
- Extraer saleDetail.ts con helpers puros (customer, refund, status presets) + saleDetail.spec.ts con 10-12 casos
- Crear SaleDetailHeader.svelte (back, título, grupos A/B/C de acciones) y cablearlo
- Crear SaleDetailNotices.svelte + SaleDetailCustomerCard.svelte y cablearlos
- Crear SaleDetailSummary.svelte + SaleDetailPayments.svelte y cablearlos
- Crear SalePaymentDrawer.svelte (SlideOver + PaymentForm) y cablearlo; podar página a ~300
- Gates: pnpm check 0, pnpm lint, pnpm test:unit, size gate sin FAIL en scope, rg imports; QA F7+F4+F1; PR

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt1-split-protocol
- dt1-payment-strategy
- public-catalog-arch
- sale-subtotal-semantics
- dt1-t2-qa
<!-- SPECS_END -->