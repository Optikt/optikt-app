---
plan name: dt9-unit-e2e
plan description: Tests para remote functions
plan status: active
---

## Idea
DT9: cobertura de tests para la capa de remote functions (que hoy tiene cero). Se separa en dos secciones: Unit/Integración (vitest + Postgres real efímero con Testcontainers) y E2E (Playwright con DB efímera). Arquitectura shell/core: el remote function queda como wrapper delgado (auth + validación + audit) y la lógica de negocio/transacción vive en funciones planas `src/lib/server/<dominio>/<accion>.ts` (`<accion>Core(input, ctx)`), testeables sin internals de SvelteKit. Se mide coverage ANTES (baseline instrumentado) y DESPUÉS (ratchet en CI). La Capa 3 usa `with_request_store` de `@sveltejs/kit/internal/server` para invocar el wrapper real sin mockear `$app/server`, con el `handleValidationError` real de la app. Se extrae el adapter de pagos de compra (`purchasePayments.ts`), desbloqueando lo diferido en `dt1-payment-strategy`. E2E: DB efímera por corrida, migraciones + seed en globalSetup, sin skips (hoy el job E2E pasa vacío), 5 flujos críticos. Sigue spec `dt9-test-harness` (repo) y `dt9-remote-core` (feature).

## Implementation
- PR-A: agregar @vitest/coverage-v8 + script test:coverage + config de coverage en vite.config.ts; medir baseline y documentarlo en docs/testing/coverage-baseline.md; escribir docs/plans/dt9-remote-tests.md y specs dt9-test-harness/dt9-remote-core/dt9-acceptance; actualizar PLAN.md (DT9 en secciones Unit/E2E + links) y cross-ref en dt1-payment-strategy.md
- PR-B: harness de integración con Testcontainers (globalSetup que levanta postgres:16, aplica migraciones de drizzle/ y expone DATABASE_URL; proyecto vitest integration con src/**/*.int.spec.ts excluido del server; resetDb() + factories mínimas) + spike que confirma importar .remote.ts en vitest y usar with_request_store (Capa 3); smoke tests de harness
- PR-C: extraer adapter src/lib/server/payments/purchasePayments.ts del cuerpo de addPurchaseOrderPaymentCmd (remote queda shell); extraer cores de dinero de venta (addSalePaymentCore, voidSalePaymentCore, setSaleStatusCore, cancelSaleCore, updateSaleCore) y testearlos contra DB real (recalc, rollback, reglas) + 1-2 tests de wrapper por command (guard, validación con hook real, audit)
- PR-D: extraer y testear cores de compras/caja/inventario (confirmPurchaseOrderCore, addPurchaseOrderPaymentCore, voidPurchaseOrderPaymentCore, cancelPurchaseOrderCore, createManualAdjustmentCore, revertFullLotCore, inventoryCountApplySessionCore, convertQuoteToSaleCore) contra DB real, con tests de wrapper mínimos
- PR-E: rework del harness E2E de Playwright (globalSetup con container efímero + migraciones + seed admin/fixtures, webServer.env.DATABASE_URL, storageState login ADMIN, workers 1), quitar los test.skip y el gating OPTIKT_RUN_PURCHASE_E2E, migrar el flujo de compra a crédito, y quitar el services.postgres del job E2E en CI
- PR-F: agregar los 5 flujos E2E (login/guards, venta wizard→pago→estado, compra crédito→pronto pago→caja, conteo→aplicar, quote→sale), job integration-tests en CI, coverage ratchet bloqueante (floor global −2pts + globs dinero/stock), reporte de coverage final y cierre de DT9 en PLAN.md

## Required Specs
<!-- SPECS_START -->
- dt9-test-harness
- dt9-remote-core
- dt1-payment-strategy
<!-- SPECS_END -->