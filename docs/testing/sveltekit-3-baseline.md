# SvelteKit 3 — baseline Fase 0

Fecha: 2026-10-22
Branch: `migrate/sk3-f0-baseline` (base `migrate/sveltekit-v3`, commit `b55a7a17`)

## Entorno

- Host: Ubuntu 26.04.1 LTS (WSL)
- Node local: `v24.20.0`
- pnpm: `11.24.0`
- Runtime objetivo: Node `22.22.2` (Kit 3 exige `>=22.17`)
- Nota: este baseline corre con Node 24 porque el host no tiene Node 22 instalado. Repetir `check`/`build` con Node 22.22.2 antes del merge final.

## Gates

| Gate                   | Comando                                                                                     | Resultado                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Instalación            | `pnpm install --frozen-lockfile`                                                            | OK                                                         |
| Tipos/Svelte           | `pnpm check`                                                                                | 0 errors, 0 warnings                                       |
| Lint/formato           | `pnpm lint`                                                                                 | OK                                                         |
| Build                  | `DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build`                     | OK, adapter-node 5.5.7, ~40s                               |
| Unit (server)          | `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci pnpm exec vitest --run --project=server` | 93 files, 982 tests OK                                     |
| Unit (server + client) | `DATABASE_URL=postgresql://ci:ci@localhost:5432/ci pnpm test:unit`                          | 93/97 files, 982 tests OK; 1 unhandled error de Playwright |

## Bloqueo de entorno

El proyecto `client` (browser) no arranca Chromium en este host:

```text
error while loading shared libraries: libnspr4.so
```

No es un fallo de código. Para completar el baseline browser:

```bash
sudo apt-get install -y libnspr4 libnss3
# o
pnpm exec playwright install-deps chromium
```

`test:integration` y `test:e2e` no se ejecutaron: Docker no está disponible en esta distro WSL (`docker: command not found`). Se validarán en la máquina de Dokploy o en CI.

## Warnings no bloqueantes del build

- Dependencias circulares internas de `@internationalized/date`.
- `Generated an empty chunk: "chunks/env.js"`.
- Timing de callbacks de plugins de Vite/rolldown.

## Siguiente

Fase 1: actualizar `@sveltejs/kit` a `^3.1.0`, `@sveltejs/adapter-node` a `^6.0.0`, mantener TypeScript `~6.0.3`, alinear Node y mover la configuración a `vite.config.ts`.
