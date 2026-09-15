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
- [ ] Wrapper `scripts/run-integration-tests.mjs`: postgres:16 + migraciones + `DATABASE_URL` seteado antes de que Vite cargue el config.
- [ ] `resetDb()` + factories mínimas.
- [ ] Spike resuelto: importar `.remote.ts` en vitest + `with_request_store` (Capa 3) — viabilidad documentada.
- [ ] Smoke test de harness verde.

## PR-C · Adapter pago compras + cores venta

- [ ] `src/lib/server/payments/purchasePayments.ts` extraído (`submitPurchaseOrderPayment` + `voidPurchaseOrderPayment`); el remote de pagos de compra es shell.
- [ ] Cores: `addSalePaymentCore`, `voidSalePaymentCore`, `setSaleStatusCore` (+ `ActionContext`/`getActionContext`).
- [ ] `cancelSaleCore` y `updateSaleCore` se mueven a PR-D (los dos más grandes: inventario/caja y replace de items).
- [ ] Tests core contra DB real: recalc, rollback, reglas de estado.
- [ ] Tests de adapter de compra contra DB real: amortización deuda nativa + void.
- [ ] 1-2 tests de wrapper por command (guard 401, validación con hook real, happy path).
- [ ] Comportamiento y UX intactos (verbatim move).

## PR-D · Cores lifecycle de venta

- [x] Cores: `cancelSaleCore`, `updateSaleCore` (movidos desde PR-C).
- [x] Tests contra DB real: cancel (happy, permisos, ya cancelada), update header-only (happy, COMPLETED bloqueado, descuento bajo lo cobrado, items vacíos).
- [x] Wrapper mínimo (`cancelSale`/`updateSale` 401).
- [ ] Pendiente: path de items de `updateSale` (FIFO) y `cancelSale` con payments/REFUNDED — requieren fixtures de lotes; ver PR-D2.

## PR-D2 · Cores inventario

- [x] Cores: `createManualAdjustmentCore`, `revertFullLotCore`.
- [x] Tests contra DB real: outflow/inflow + stock cacheado, stock insuficiente, lote inexistente; revert happy, lote consumido, lote inexistente.
- [x] Wrapper mínimo (401) + factories `createPurchaseOrderItem`/`createInventoryLot`.
- [ ] Pendiente → PR-D3.

## PR-D3 · Compras/stock + FIFO

- [x] Tests query-level de `confirmPurchaseOrder`/`cancelPurchaseOrder` (crea lote, mueve stock, guards de estado/revisión).
- [x] Test FIFO de `cancelSaleCore` (restaura lote consumido + stock cacheado).
- [x] Factories: `createSaleItem`, `createInventoryMovement`.
- [ ] Pendiente → PR-D4.

## PR-D4 · Quote

- [x] `convertQuoteToSaleCore` extraído (`src/lib/server/quotes/`); `quotes/lifecycle.remote.ts` shell.
- [x] Tests de guardas: no encontrado, no borrador, sin cliente asignado, sin ítems.
- [ ] PR-D5 (opcional): happy path de conversión, path FIFO de `updateSale`, `inventoryCount.applySession` (su core ya existe como query).

## PR-D5 · Cierre de cobertura (opcional)

- [ ] Happy path de `convertQuoteToSaleCore`, FIFO de `updateSaleCore`, `applyInventoryCountSession`.

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
