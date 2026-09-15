# Spec: dt9-test-harness

Scope: repo

# DT9 · Test harness (integración DB real + E2E)

Contrato reusable de infraestructura de tests. No describe un dominio; describe **cómo** se monta y se aísla la DB y cómo se invoca un remote function sin mockear framework.

## Principios

- NO mockear la DB. Un mock no prueba constraints, transacciones, FIFO ni round-trip de tipos.
- NO reusar una DB persistente (dev/compose). Estado bleed + riesgo de pisar data real.
- DB real **efímera por corrida** (Testcontainers). Local = CI, mismo camino.
- El `.remote.ts` es shell; la lógica vive en `src/lib/server/<dominio>/<accion>.ts` (ver `dt9-remote-core`). El grueso se testea por la función plana; el wrapper se testea mínimo.

## Capa 2 — Integración (vitest + Postgres efímero)

- Dep: `@testcontainers/postgresql` (devDependency). Imagen `postgres:16`.
- Proyecto vitest nuevo `integration`:
  - `environment: 'node'`
  - `include: ['src/**/*.int.spec.ts']`
  - Excluir `**/*.int.spec.ts` del proyecto `server` para no correrlo sin DB.
  - `pool: 'forks'` y `fileParallelism: false` para evitar choques de truncate entre archivos.
- El container lo levanta `scripts/run-integration-tests.mjs` (wrapper), **no** un `globalSetup`:
  - SvelteKit inlinea `$env/dynamic/private` desde `.env` al cargar el Vite config; un `globalSetup` corre después, así que el `db` de la app seguiría apuntando a la DB de dev.
  - El wrapper arranca postgres:16, aplica migraciones de `drizzle/`, setea `process.env.DATABASE_URL` y recién ahí spawnea `vitest --project=integration` (Vite `loadEnv` deja que `process.env` pise `.env`). Teardown: `container.stop()`.
  - Entrypoint: `pnpm test:integration` → `node scripts/run-integration-tests.mjs`.
- Migraciones: reusar `drizzle/` con `drizzle-orm/postgres-js/migrator` (mismo mecanismo que `scripts/bootstrap.js`). No duplicar SQL.
- Aislamiento por test: `resetDb()` hace `TRUNCATE <tablas de app> RESTART IDENTITY CASCADE` (nunca la tabla de migraciones de drizzle). Factories mínimas con `runId` único.
- Factories mínimas (solo campos NOT NULL relevantes): `user(role)`, `supplier`, `customer`, `product`, `material`, `sale`. Mantenerlas chicas para que no haya drift con el schema.
- Pool: el proyecto usa forks; `globalSetup` debe dejar `DATABASE_URL` visible a los workers. Si el env no se propaga, usar `provide`/`inject` o un archivo de URL temporal.

## Capa 3 — Wrapper (`callRemote`), acotada

- Helper aislado (un solo archivo) que invoca el wrapper real sin mockear `$app/server`:
  - `with_request_store` importado de `@sveltejs/kit/internal/server`.
  - `createTestStore` arma `{ event, state }` clonando la forma canónica de `src/runtime/server/respond.js`:
    - event: `request` (`new Request(url, { method })`), `url`, `locals`, `cookies`, `getClientAddress`, `fetch`, `params`, `route`, `setHeaders`, `isDataRequest`, `isRemoteRequest`.
    - state: `prerendering`, `transport`, `handleValidationError`, `tracing`, `remote`, flags `is_in_*` en false.
  - `command` exige método mutativo → POST. `query` → GET.
- **Regla de fidelidad (obligatoria):** el `handleValidationError` del harness es el **hook real** de la app (`src/hooks.server.ts` → `buildValidationMessage`). Nunca hardcodear una semántica distinta a producción (error conocido del PR #15671 de SvelteKit).
- **Pin de internals:** documentar la versión de `@sveltejs/kit` usada. Si Kit cambia `with_request_store`/`RequestState`, solo se arregla este archivo; agregar un test que falle ruidoso si el import desaparece.
- Alcance: 1-2 tests por command crítico, solo wiring de la app (guards/permisos, rollback de transacción, audit emitido, validación). No re-testear el framework.

## Coverage

- `@vitest/coverage-v8` (match vitest 5). Script `test:coverage`.
- `coverage.include`: `src/lib/server/**`, `src/lib/remote/**`, `src/lib/shared/**`, `src/lib/schemas/**`.
- Reporters: `text-summary`, `json-summary`, `html`.
- Baseline en `docs/testing/coverage-baseline.md` (antes de tests nuevos).
- Policy al cierre (ratchet): floor global = medido final −2pts + globs de dinero/stock con barra más alta; bloqueante en CI.

## CI

- Job `unit-tests`: sigue con DB dummy (no toca integración).
- Job `integration-tests`: Testcontainers (Docker disponible en `ubuntu-latest`); corre solo `*.int.spec.ts`.
- Job `e2e-tests` (main only): sin `services.postgres`; el `globalSetup` de Playwright levanta la DB.

## Restricciones del repo

- No barrels nuevos. No `any` nuevos. No comentarios nuevos. `scripts/check-file-size.sh` aplica a archivos nuevos.
