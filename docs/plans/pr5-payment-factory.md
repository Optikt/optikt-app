---
plan name: pr5-payment-factory
plan description: Factory y flujos de dinero
plan status: active
---

## Idea
DT9 PR-5: cerrar la deuda estructural de PaymentForm.svelte (518 líneas, excepción documentada en scripts/check-file-size.sh) extrayendo la lógica reactiva de dinero a un state factory, y agregar los 4 flujos E2E de dinero pendientes (DT9 PR-F2). Un PR con 2 commits, E2E primero como red de seguridad. Commit 1 (E2E): e2e/fixtures.ts con seeds SQL + runId + db helper, y 4 specs — venta wizard→pago→estado (sale-payment.test.ts), compra crédito→pronto pago→caja (purchase-payment.test.ts), conteo→cerrar/aplicar (inventory-count.test.ts), presupuesto→convertir→venta (quote-to-sale.test.ts); datos prerequisito por SQL, la acción bajo test por UI con selectores role/name; refactor de e2e/purchase-order.test.ts para reusar fixtures; workers:1 y runId único por test (sin reset cross-test, deuda documentada). Commit 2 (factory): paymentFormModel.svelte.ts (createPaymentFormModel(getProps, sel)) y purchaseFlowState.svelte.ts (modales/beneficio + callbacks/snapshot/api), PaymentForm.svelte 518→~160 con verbatim move, los 3 $effect y resets absorbidos en PaymentFormSelection; component tests con vitest-browser-svelte (ya instalado, primer .svelte.spec.ts del repo → spike previo de wiring en el proyecto client) y paymentFormDerived.spec.ts para las ~20 fns puras sin spec. Coverage Sonar: agregar coverage.include acotado a los archivos nuevos + paymentFormDerived.ts con threshold propio lines>=80, global intacto, SIN excluir componentes. Cierre: borrar la excepción de PaymentForm en scripts/check-file-size.sh y actualizar docs dt1-f5-money, dt1-payment-strategy, dt9-acceptance (PR-F2), dt9-unit-e2e. Gates: pnpm check, lint, test:unit (server+client), test:integration, check-file-size.sh, test:e2e, coverage/Sonar, rg imports (no barrels).

## Implementation
- Spike de component testing: crear un *.svelte.spec.ts trivial con vitest-browser-svelte en el proyecto client (chromium) y validar pnpm test:unit; dejar documentado el wiring necesario.
- E2E commit 1: crear e2e/fixtures.ts (seeds SQL + runId + db helper) y los 4 flujos (sale-payment, purchase-payment, inventory-count, quote-to-sale); refactorizar e2e/purchase-order.test.ts para reusar fixtures; datos por SQL y accion bajo test por UI con selectores role/name.
- Verde E2E local (pnpm test:e2e) y en CI del PR; commit 'test(dt9): money flows E2E'.
- Factory commit 2: extraer purchaseFlowState.svelte.ts y paymentFormModel.svelte.ts; absorber los 3 $effect y resets en PaymentFormSelection; dejar PaymentForm.svelte ~160 lineas con markup y binding verbatim.
- Component tests: paymentFormModel.svelte.spec.ts, paymentRailSection.svelte.spec.ts y paymentFormDerived.spec.ts; agregar coverage.include acotado (archivos nuevos + paymentFormDerived.ts) con threshold lines>=80 sin tocar el global.
- Cerrar la excepcion en scripts/check-file-size.sh y actualizar docs (dt1-f5-money, dt1-payment-strategy, dt9-acceptance PR-F2, dt9-unit-e2e); correr todos los gates + Sonar y dejar el PR listo para review.

## Required Specs
<!-- SPECS_START -->
- dt9-test-harness
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- pr5-payment-factory
<!-- SPECS_END -->