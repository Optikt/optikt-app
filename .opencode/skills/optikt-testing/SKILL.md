---
name: Optikt testing
description: Cómo correr y escribir pruebas en Optikt (vitest server/client/integration, Playwright e2e, testcontainers). Usar al probar un fix, escribir una prueba nueva, o verificar que no rompiste nada.
---

# Pruebas (Optikt)

## Proyectos de vitest (`vite.config.ts`)

| Proyecto | Include | Entorno |
| --- | --- | --- |
| `server` | `src/**/*.{test,spec}.{js,ts}` (excluye `.svelte.*` y `*.int.spec.ts`) | node |
| `client` | `src/**/*.svelte.{test,spec}.{js,ts}` | navegador real (Playwright, chromium headless) + `vitest-browser-svelte` |
| `integration` | `src/**/*.int.spec.ts` | node, `pool: forks`, sin paralelismo, DB real |

Comandos:

```sh
pnpm test:unit            # server + client
pnpm exec vitest --run --project=server <archivo.spec.ts>
pnpm exec vitest --run --project=client
pnpm test:integration     # levanta Postgres 16 con testcontainers y migra el schema
pnpm test:coverage
pnpm test:e2e             # build + preview + Playwright
```

- Nombres: `*.spec.ts` / `*.test.ts` (conviven), componentes `*.svelte.spec.ts`, integración `*.int.spec.ts`.
- Ubicación: **colocadas** junto al archivo que prueban.
- `expect.requireAssertions: true`: una prueba sin `expect` falla. No dejes pruebas vacías.

## Integración (DB real)

- Runner: `scripts/run-integration-tests.mjs` (testcontainers `postgres:16`, aplica `drizzle/`, corre `--project=integration`).
- Harness y factories: `src/lib/testing/remoteHarness.ts`, `src/lib/testing/integration/factories.ts` (`createSale`, `createUser`), `resetDb` en `src/lib/testing/integration/db.ts`.
- Usa integración cuando el riesgo es la **transacción o el SQL**, no la fórmula.

## E2E (Playwright)

- `playwright.config.ts` → `testDir: 'e2e'`, `workers: 1`, `webServer: pnpm build && pnpm preview` (puerto 4173).
- `scripts/run-e2e-tests.mjs` levanta Postgres, exporta `DATABASE_URL`, corre `scripts/bootstrap.js` y luego Playwright.
- Convenciones: `e2e/*.test.ts`, `e2e/fixtures.ts` (seeds por SQL crudo, `connectDatabase`, `ensureAdmin`), `e2e/auth.ts` (credenciales).

## Método

1. **Reproduce primero**: escribe la prueba que falla *antes* del fix (`test-author` puede hacerlo).
2. Elige el nivel **más barato que pruebe el riesgo**: pureza → `server`; render/reactividad → `client`; SQL/transacción → `integration`; flujo completo → `e2e`.
3. Corre la prueba **y** el gate mínimo: `pnpm check` + `pnpm exec eslint <archivos cambiados>`.
4. No bajes umbrales de cobertura para pasar (`vite.config.ts`); arregla la causa.

## Checklist

- [ ] ¿Existe una prueba que falla sin mi cambio y pasa con él?
- [ ] ¿Corrí el proyecto de vitest correcto (y no solo el archivo)?
- [ ] ¿`pnpm check` y `eslint` en verde?
- [ ] ¿Si toqué DB, la prueba es `.int.spec.ts` con testcontainers?
