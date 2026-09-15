# Plan: DT9 · Tests de remote functions (Unit/Integración + E2E)

> Plan activo. Ejecución por fases (PR-A .. PR-F). Cada fase arranca leyendo este doc + `docs/specs/dt9-acceptance.md`.

## Problema

La capa de remote functions (`.remote.ts`) es donde vive la orquestación de negocio (crear venta, registrar pago, confirmar orden de compra, ajustar inventario). Hoy tiene **cero** tests directos: los 936 tests existentes cubren schemas, utils, helpers y queries, pero no la orquestación. Una regresión en un comando de dinero/inventario no tiene red de seguridad.

Dificultad estructural: un `.remote.ts` usa `$app/server` + `getRequestEvent()`; llamarlo en vitest sin contexto de request lanza `Could not get the request store`. SvelteKit **no** tiene test utils oficiales (issue [#14796](https://github.com/sveltejs/kit/issues/14796) abierto; PR [#15671](https://github.com/sveltejs/kit/pull/15671) sin mergear y rechazado por un maintainer con el argumento de que "el wrapper es framework code; la lógica debe vivir en una función plana").

## Decisiones

### 1. Arquitectura shell/core

```
.remote.ts  = shell:   command(Schema) + requireRole + getAuditContext  → delega
core.ts     = trabajo: reglas de negocio + db.transaction + queries con tx
                       src/lib/server/<dominio>/<accion>.ts → <accion>Core(input, ctx)
tests       = llaman core directo contra DB real; el wrapper se testea mínimo
```

Contrato: `ActionContext = { userId, role, ipAddress, userAgent }`.

Detalle en `docs/specs/dt9-remote-core.md`. Motivo: hace los tests escalables y entendibles, y mueve el esfuerzo a testing real en lugar de batallar con la infra de remotes.

### 2. DB en tests: real y efímera, nunca mock

- **Integración:** Postgres real por corrida vía Testcontainers. Migraciones una vez en el wrapper `scripts/run-integration-tests.mjs`; `resetDb()` + factories por test; el container muere al final.
- **E2E:** el mismo container, + seed de fixtures. El container se gestiona antes de arrancar la app (wrapper), porque SvelteKit inlinea `$env/dynamic/private` al construir/cargar config; pasar `DATABASE_URL` al `webServer` por sí solo no alcanza.
- **Por qué no mock:** un mock no prueba constraints, transacciones, FIFO ni round-trip de tipos (falso verde).
- **Por qué no DB persistente (dev/compose):** estado bleed, seeds rotos entre corridas, riesgo de pisar data real, setup manual por máquina.

Detalle en `docs/specs/dt9-test-harness.md`.

### 3. Capa 3 (wrapper) acotada y fiel

- Se invoca el wrapper **real** sin mockear `$app/server`: `with_request_store` de `@sveltejs/kit/internal/server` + un `{ event, state }` que clona la forma canónica de `runtime/server/respond.js`.
- **Fidelidad obligatoria:** el harness usa el `handleValidationError` **real** de la app (`src/hooks.server.ts`). Nunca hardcodeado (ese es el defecto del PR de SvelteKit rechazado).
- **Alcance:** 1-2 tests por command crítico, solo wiring de la app (guards/permisos, rollback, audit, validación). No re-testear el framework.
- **Riesgo:** internals de Kit pueden cambiar → se arregla un solo archivo; pin de versión + test que falle ruidoso.

### 4. Coverage: medir antes y después

- **Antes (PR-A):** instrumentar `@vitest/coverage-v8`, correr y guardar `docs/testing/coverage-baseline.md`.
- **Después (PR-F):** ratchet bloqueante en CI — floor global = medido final −2pts + globs de dinero/stock con barra más alta.

## Fases

### PR-A · Coverage baseline + docs (0.5d)

- `@vitest/coverage-v8` (match vitest 5), script `test:coverage`, config de coverage.
- `docs/testing/coverage-baseline.md` con el punto de partida.
- Docs de este plan y specs `dt9-test-harness`, `dt9-remote-core`, `dt9-acceptance`; cross-ref en `dt1-payment-strategy`; `PLAN.md`.
- Sin tests nuevos, sin tocar remotes.

### PR-B · Harness de integración + spike Capa 3 (1.5d)

- Testcontainers vía wrapper `scripts/run-integration-tests.mjs`: postgres:16, migraciones de `drizzle/`, `DATABASE_URL` seteado antes de que Vite cargue el config.
- Proyecto vitest `integration` (`src/**/*.int.spec.ts`, excluido de `server`); `resetDb()`; factories mínimas.
- Spike (una vez): importar `.remote.ts` en vitest + `with_request_store`. Confirma o descarta Capa 3; Capa 2 no se bloquea.
- Smoke tests del harness.

### PR-C · Adapter pago compras + cores de dinero de venta (3d)

- Extraer `src/lib/server/payments/purchasePayments.ts` del cuerpo de `addPurchaseOrderPaymentCmd` (remote queda shell). Desbloquea lo diferido en `dt1-payment-strategy`.
- Cores: `addSalePaymentCore`, `voidSalePaymentCore`, `setSaleStatusCore`, `cancelSaleCore`, `updateSaleCore`.
- Tests core contra DB real (recalc, rollback, reglas) + 1-2 de wrapper por command.

### PR-D · Cores compras/caja/inventario (2-3d)

- `confirmPurchaseOrderCore`, `addPurchaseOrderPaymentCore`, `voidPurchaseOrderPaymentCore`, `cancelPurchaseOrderCore`, `createManualAdjustmentCore`, `revertFullLotCore`, `inventoryCountApplySessionCore`, `convertQuoteToSaleCore`.
- Tests core + wrapper mínimo.

### PR-E · Rework del harness E2E (1.5d)

- `globalSetup`/wrapper de Playwright: container efímero → migraciones + admin (`scripts/bootstrap.js`) → seed fixtures → env para el `webServer`.
- `storageState` login ADMIN; `workers: 1`.
- Quitar `test.skip` y el gating `OPTIKT_RUN_PURCHASE_E2E`; migrar el flujo de compra a crédito.
- Quitar `services.postgres` del job E2E en CI.

### PR-F · Flujos E2E + CI + cierre (2d)

- 5 flujos: login/guards, venta wizard→pago→estado, compra crédito→pronto pago→caja, conteo→aplicar, quote→sale.
- Job `integration-tests` en CI; E2E solo en main.
- Coverage ratchet bloqueante; reporte de coverage final; cierre de DT9 en `PLAN.md`.

## Definition of Done

- [ ] Coverage baseline + reporte final commiteados.
- [ ] CI: job integration + job e2e (main) + coverage gate.
- [ ] Cores de los 14 commands críticos testeados contra DB real.
- [ ] `purchasePayments.ts` extraído + testeado (desbloquea `dt1-payment-strategy`).
- [ ] 5 flujos E2E verdes en main, sin skips.
- [ ] Specs + `PLAN.md` DT9 ✅.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Spike Capa 3 falla (import `.remote.ts` / transform del plugin) | Capa 2 entrega el grueso; el core es el camino principal |
| Internals de Kit cambian (`with_request_store`, `RequestState`) | Un solo archivo; pin de versión + test ruidoso |
| `DATABASE_URL` no se propaga a workers vitest | Wrapper arranca el container antes de Vite; `process.env` pisa `.env` en `loadEnv` |
| `$env/dynamic/private` inlinea la DB de dev | El wrapper setea `DATABASE_URL` pre-config (resuelto en PR-B; test lo validó) |
| Factories drift con el schema | Factories mínimas (solo NOT NULL relevantes) |
| E2E flaky | `workers: 1`, selectores por role/name, sin waits fijos |

## Rollback

Cada PR es independiente y reversible por separado: PR-A solo agrega tooling/docs; PR-B..D agregan tests y extraen cores verbatim (comportamiento intacto); PR-E/F solo tocan infra de tests y CI.
