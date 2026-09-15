# Spec: dt9-acceptance

Scope: feature

# DT9 · Checklist de aceptación por fase

Cada fase (PR) se considera cerrada cuando su bloque está completo. Gates globales aplican a todos: `pnpm check` 0 errores, `pnpm lint`, `pnpm test:unit` verde, `bash scripts/check-file-size.sh`.

## PR-A · Coverage baseline + docs

- [ ] `@vitest/coverage-v8` en devDependencies, versión alineada a vitest 5.
- [ ] Script `test:coverage` en `package.json`.
- [ ] Config de coverage en `vite.config.ts` (`include` server/remote/shared/schemas; reporters text-summary/json-summary/html).
- [ ] `docs/testing/coverage-baseline.md` con global + por directorio.
- [ ] Docs: `docs/plans/dt9-remote-tests.md`, `docs/specs/dt9-test-harness.md`, `docs/specs/dt9-remote-core.md`, `docs/specs/dt9-acceptance.md`.
- [ ] Cross-ref en `docs/specs/dt1-payment-strategy.md` (adapter de compra: "diferido" → "DT9 lo extrae").
- [ ] `PLAN.md` DT9 en secciones Unit/E2E + links a plan/specs.
- [ ] Cero tests nuevos; cero cambios en remotes.

## PR-B · Harness de integración + spike

- [ ] `@testcontainers/postgresql` en devDependencies.
- [ ] Proyecto vitest `integration` (`src/**/*.int.spec.ts`) excluido del proyecto `server`.
- [ ] `globalSetup`: postgres:16, migraciones de `drizzle/`, `DATABASE_URL` visible a workers.
- [ ] `resetDb()` + factories mínimas.
- [ ] Spike resuelto: importar `.remote.ts` en vitest + `with_request_store` (Capa 3) — viabilidad documentada.
- [ ] Smoke test de harness verde.

## PR-C · Adapter pago compras + cores venta

- [ ] `src/lib/server/payments/purchasePayments.ts` extraído; `addPurchaseOrderPaymentCmd` es shell.
- [ ] Cores: `addSalePaymentCore`, `voidSalePaymentCore`, `setSaleStatusCore`, `cancelSaleCore`, `updateSaleCore`.
- [ ] Tests core contra DB real: recalc, rollback, reglas de estado.
- [ ] 1-2 tests de wrapper por command (guard, validación con hook real, audit).
- [ ] Comportamiento y UX intactos (verbatim move).

## PR-D · Cores compras/caja/inventario

- [ ] Cores: `confirmPurchaseOrderCore`, `addPurchaseOrderPaymentCore`, `voidPurchaseOrderPaymentCore`, `cancelPurchaseOrderCore`, `createManualAdjustmentCore`, `revertFullLotCore`, `inventoryCountApplySessionCore`, `convertQuoteToSaleCore`.
- [ ] Tests core contra DB real + wrapper mínimo.
- [ ] FIFO / recalc de saldos / crédito cubiertos.

## PR-E · Rework E2E

- [ ] `globalSetup` Playwright: container efímero + migraciones + admin + fixtures.
- [ ] `webServer.env.DATABASE_URL` apunta al container.
- [ ] `storageState` login ADMIN; `workers: 1`.
- [ ] Sin `test.skip` ni gating `OPTIKT_RUN_PURCHASE_E2E`.
- [ ] Flujo de compra a crédito migrado y verde.
- [ ] `services.postgres` eliminado del job E2E.

## PR-F · Flujos + CI + cierre

- [ ] 5 flujos E2E verdes: login/guards, venta wizard→pago→estado, compra crédito→pronto pago→caja, conteo→aplicar, quote→sale.
- [ ] Job `integration-tests` en CI.
- [ ] E2E solo en main.
- [ ] Coverage ratchet bloqueante (floor global −2pts + globs dinero/stock).
- [ ] `docs/testing/coverage-baseline.md` contrastado con reporte final.
- [ ] `PLAN.md` DT9 ✅.
