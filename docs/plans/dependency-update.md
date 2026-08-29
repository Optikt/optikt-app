# Plan: Actualización de Dependencias (2026-08-27)

> Evaluación completa `pnpm outdated` + SvelteKit 3 RC + remote functions. Branch `chore/deps-2026-08`.
> Contexto: `PLAN.md:DT17` pinneó `pdfjs-dist + @pdfslick/core` — fuera de este plan.
> Último `pnpm outdated` 2026-08-28: 37 pendientes (2 pinneados, 1 deprecated, 2 majors bloqueados, resto tandas).

## 1. Snapshot completo

| Paquete | Instalado | Latest | Tipo | Tanda |
|---|---|---|---|---|
| `prettier` | 3.9.6 | 3.9.6 (3.9.5→) | patch | 1 |
| `prettier-plugin-tailwindcss` | 0.8.0 | 0.8.1 | patch | 2 |
| `eslint` | 10.7.0 | 10.9.1 | patch | 1 |
| `eslint-plugin-svelte` | 3.20.0 | 3.23.0 | minor | 1 |
| `typescript-eslint` | 8.63.0 | 8.68.0 | minor | 1 |
| `globals` | 17.7.0 | 17.11.0 | minor | 1 |
| `knip` | 6.27.0 | 6.32.2 | minor | 1 |
| `svelte-doctor` | 0.3.1 | 0.3.7 | patch | 1 |
| `tsx` | 4.23.0 | 4.23.12 | patch | 1 |
| `tailwindcss` | 4.3.2 | 4.3.3 | patch | 2 |
| `@tailwindcss/vite` | 4.3.2 | 4.3.3 | patch | 2 |
| `tailwind-variants` | 3.2.2 | 3.3.1 | minor | 2 |
| `bits-ui` | 2.18.1 | 2.19.0 | minor | 3 |
| `svelte-sonner` | 1.1.1 | 1.2.1 | patch | 3 |
| `@internationalized/date` | 3.12.2 | 3.12.3 | patch | 3 |
| `export-to-csv` | 1.4.0 | 1.5.0 | minor | 3 |
| `libphonenumber-js` | 1.13.8 | 1.13.12 | patch | 3 |
| `@node-rs/argon2` | 2.0.2 | 2.1.0 | minor | 3 |
| `zod` | 4.3.6 | 4.4.3 | minor | 4 |
| `svelte-check` | 4.7.2 | 4.7.6 | patch | 4 |
| `svelte` | 5.56.4 | 5.56.10 | patch | 5 |
| `@sveltejs/kit` | 2.69.2 | 2.70.3 | patch | 5 |
| `@sveltejs/vite-plugin-svelte` | 7.2.0 | 7.3.0 | minor | 5 |
| `vite` | 8.1.4 | 8.2.2 | patch | 5 |
| `drizzle-orm` | 0.45.2 | 0.45.2 | al día | — |
| `vitest` | 4.1.10 | 4.1.11 | patch | 6 |
| `@vitest/browser-playwright` | 4.1.10 | 4.1.11 | patch | 6 |
| `@playwright/test` | 1.61.1 | 1.62.1 | minor | 6 |
| `playwright` | 1.61.1 | 1.62.1 | minor | 6 |
| `puppeteer-core` | 25.3.0 | 25.8.0 | minor | **defer** |
| `@sparticuz/chromium` | 149.0.0 | 149.0.0 | al día | — |
| `pdfjs-dist` | 6.0.227 exact | 6.2.108 | **NO TOCAR — DT17** | — |
| `@pdfslick/core` | 4.0.0 exact | 4.0.2 | **NO TOCAR — DT17** | — |
| `svelecte` | 5.3.0 | 5.3.0 | al día | — |
| `@types/node` | ^22 | 26.3.0 | **NO TOCAR** (runtime 22.22.2) | — |
| `@oslojs/crypto` | 1.0.1 | Deprecated | **Reemplazar — Tanda 7** | 7 |
| `typescript` | 6.0.3 | 7.0.2 | **MAJOR BLOQUEADO** | — |
| `@lucide/svelte` | 0.577.0 | 1.34.0 | **MAJOR BLOQUEADO** | — |
| GitHub Actions | checkout 4, setup-node 4, docker/*, pnpm 4 | 7 / 6.0.10 | **MAJOR defer** | — |

## 2. Qué NO tocar en este ciclo

- **`pdfjs-dist` + `@pdfslick/core`**: pinneados exactos por `DT17`. Worker mismatch histórico (`edb9847`). Solo revisitar cuando upstream soporte pdfjs ≥6.2.
- **`@types/node`**: quedarse en `^22` — debe matchear runtime (`node --version` = 22.22.2).
- **`puppeteer-core` / `@sparticuz/chromium`**: el `500 libnspr4.so` de 2026-08-27 fue entorno dev (falta `libnspr4`/`libnss3` en `100.122.162.118`), no versión. En prod funciona (`Dockerfile:27 apk add chromium`). Probar solo con validación de `src/lib/server/pdf.ts` + `CHROMIUM_PATH` — fuera de scope.
- **`typescript@7` / `@lucide/svelte@1`**: majors con breaking, ver §6.
- **SvelteKit 3**: RC desde 2026-08-13 (`3.0.0-next.25`). No migrar hasta stable. Remote functions siguen experimentales incluso en v3 (requieren `kit.experimental.remoteFunctions` + `compilerOptions.experimental.async`; `async` se quita recién en Svelte 6).

## 3. Tandas (1 commit por tanda, fácil revert)

Cada tanda: `pnpm update <pkgs> && pnpm check && pnpm lint && pnpm build && pnpm test:unit`. Si algo falla, `git revert HEAD`.

### Tanda 1 — Tooling sin runtime (15 min)

Paquetes de lint/tipo que no tocan el bundle: `prettier`, `eslint`, `eslint-plugin-svelte`, `typescript-eslint`, `globals`, `knip`, `svelte-doctor`, `tsx`.
No esperado breaking. Si rompe, solo CI.

```bash
pnpm update prettier eslint eslint-plugin-svelte typescript-eslint globals knip svelte-doctor tsx
```

### Tanda 2 — Styling (10 min)

`tailwindcss`, `@tailwindcss/vite`, `prettier-plugin-tailwindcss`, `tailwind-variants`. Requiere rebuild + inspección visual.

```bash
pnpm update tailwindcss @tailwindcss/vite prettier-plugin-tailwindcss tailwind-variants
```

### Tanda 3 — Runtime UI (15 min)

Componentes cliente: `bits-ui`, `svelte-sonner`, `@internationalized/date`, `export-to-csv`, `libphonenumber-js`, `@node-rs/argon2` (auth hashing — probar login).

```bash
pnpm update bits-ui svelte-sonner @internationalized/date export-to-csv libphonenumber-js @node-rs/argon2
```

### Tanda 4 — Validación + typecheck (10 min)

`zod` (150+ schemas en `src/lib/schemas/`), `svelte-check`. Zod minor puede cambiar mensajes de error — revisar `pnpm check` y tests de schemas.

```bash
pnpm update zod svelte-check
```

### Tanda 5 — Framework core (30 min, JUNTOS)

`@sveltejs/kit`, `svelte`, `@sveltejs/vite-plugin-svelte`, `vite`. Van juntos: `vite-plugin 7.3` asume `vite 8.2 + svelte 5.56`. Separarlos pide mismatch. Es la tanda con más riesgo — probar wizard ventas + build.

```bash
pnpm update @sveltejs/kit svelte @sveltejs/vite-plugin-svelte vite
```

### Tanda 6 — Test infra (15 min)

`vitest`, `@vitest/browser-playwright`, `playwright`, `@playwright/test`. Dependen de Tanda 5. Requiere `pnpm playwright install --with-deps chromium` en CI.

```bash
pnpm update vitest @vitest/browser-playwright @playwright/test playwright
pnpm test:e2e   # solo tras Tanda 5+6
```

### Tanda 7 — Reemplazo `@oslojs/crypto` (20 min, PR aparte)

`src/lib/server/auth.ts:2` usa `sha256` deprecated. Reemplazar por `node:crypto` (`createHash('sha256')`), quitar dep, `pnpm check`.

## 4. Verificación por tanda

| Paso | Comando | Qué detecta |
|---|---|---|
| types | `pnpm check` | `svelte-check` 0 errors |
| estilo | `pnpm lint` | prettier + eslint |
| build | `pnpm build` | ~45s, circulares `@internationalized/date` pre-existentes OK |
| unit | `pnpm test:unit` | 758 tests actuales |
| e2e | `pnpm test:e2e` | solo tandas 5-6 |
| manual | login → ventas wizard → `/api/pdf/sale/<id>` 200 → `PDFViewerModal` carga → inventario | solo tandas 3-5 |

## 5. Checklist branch `chore/deps-2026-08` — Estado 2026-08-29

- [x] Branch creado, DT17 pinneado (`pdfjs-dist 6.0.227 exact`, `@pdfslick/core 4.0.0 exact` / `PLAN.md:DT17`)
- [x] Tanda 1 — tooling · `26dbeaf` — `prettier 3.9.6, eslint 10.9.1, eslint-plugin-svelte 3.23.0, typescript-eslint 8.68.0, globals 17.11.0, knip 6.32.3, svelte-doctor 0.3.7, tsx 4.23.12` → check 0, build 36s, 771 tests
- [x] Tanda 2 — styling · `9347b74` — `tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, prettier-plugin-tailwindcss 0.8.1, tailwind-variants 3.3.1` → check 0, build 1m15s, 771 tests
- [x] Tanda 3 — runtime UI · `374724c` + `414213b` — `bits-ui 2.19.0, svelte-sonner 1.2.1, @internationalized/date 3.12.3, export-to-csv 1.5.0, libphonenumber-js 1.13.12, @node-rs/argon2 2.2.0` → check 0, build 1m23s, 771 tests
- [x] Tanda 4 — validación · `bef338e` — `zod 4.3.6→4.5.1, svelte-check 4.7.2→4.7.6` (zod 4.5.4 quedó <24h `minimumReleaseAge`) → check 0, build 36.9s, 771 tests
- [x] Tanda 5 — framework core · `5e6a035` + `381931b` — `@sveltejs/kit 2.69.2→2.70.3, svelte 5.56.4→5.57.0, @sveltejs/vite-plugin-svelte 7.2.0→7.3.0, vite 8.1.4→8.2.2` → check 0, build 1m02s→3m07s, 771 tests
- [x] Tanda 6 — test infra · `2e9003c` — `vitest 4.1.11, @vitest/browser-playwright 4.1.11, @playwright/test 1.62.1, playwright 1.62.1, knip 6.33.0` → check 0, build 35s, 771 tests (vitest 4.1.11)
- [ ] Tanda 7 — @oslojs/crypto → node:crypto — **PAUSADA, PR separado** (ver §6 PR-A)
- [x] Push `chore/deps-2026-08` → origin (6 tandas, `pnpm-workspace.yaml` minimumReleaseAgeExclude actualizado para `argon2@2.2.0` + `svelte@5.57.0`)

Cada tanda = `chore(deps): tanda N — <descripción>` para `git revert` limpio.

## 6. PRs separados — TODO CON CUIDADO

> Ninguno de estos entra en `chore/deps-2026-08`. Cada uno es branch + PR propio, con su propia verificación. No mezclar.

### PR-A · `@oslojs/crypto` → `node:crypto` — PAUSADA 🔴

- **Scope:** `src/lib/server/auth.ts:2` (`sha256` de `@oslojs/crypto` deprecated). Solo 1 import, pero toca hashing de sesión.
- **Riesgo:** Si el hash cambia, sesiones existentes se invalidan. `verify` de password usa `@node-rs/argon2`, no este — impacto solo en token/session hash, no passwords.
- **Pasos:** Reemplazar `import { sha256 } from '@oslojs/crypto/sha2'` por `createHash('sha256')` de `node:crypto`; quitar dep; `pnpm check` + `test:unit` + login manual + rotar una sesión.
- **Branch sugerido:** `chore/auth-node-crypto`
- **No olvidar:** `@oslojs/encoding` (`1.1.0`) se queda — no está deprecated.

### PR-B · `typescript 6.0.3 → 7.0.2` — BLOQUEADO 🟡

- **Scope:** Major. SvelteKit 3 aún declara TS 6, `svelte-check 4.7.6` y `typescript-eslint 8.68.0` no certificados con TS 7.
- **Riesgo:** `svelte-check` puede reportar falsos positivos, `vite` types rotos.
- **Cuándo:** Esperar Kit 3 stable + `svelte-check` que declare soporte TS7. Branch `chore/typescript-7`.

### PR-C · `@lucide/svelte 0.577.0 → 1.35.0` — BLOQUEADO 🟡

- **Scope:** `0.x → 1.x` reescribe API `Icon` — 150+ imports en `src/lib/components`. Codemod + QA visual obligatorio.
- **Riesgo:** Icons desaparecen / props renombrados. No es bump, es migración.
- **Branch sugerido:** `chore/lucide-1` — hacer con `pnpm update @lucide/svelte` + `grep -R lucide` + revisión visual de cada vista.
- **Verificación:** `pnpm check`, `pnpm build`, screenshots de sidebar, modals, tablas.

### PR-D · `puppeteer-core 25.3.0 → 25.9.0` (+ `@sparticuz/chromium`) — DEFERIDO 🟢

- **Scope:** `src/lib/server/pdf.ts` (`generatePdf`, `CHROMIUM_PATH`). En prod funciona (`Dockerfile:27 apk add chromium`), en dev falló `libnspr4.so` el 2026-08-27 por falta de `apt` libs, no por versión.
- **Pasos previos:** `sudo apt-get install libnspr4 libnss3 ...` o usar `CHROMIUM_PATH=/usr/bin/chromium`. Luego bump + `curl /api/pdf/sale/<id>` debe dar 200 + `PDFViewerModal` carga.
- **Branch sugerido:** `chore/puppeteer-25.9`

### PR-E · GitHub Actions `4 → 7` — DEFERIDO 🟢

- **Scope:** `.github/workflows/tests.yml` — `actions/checkout 4→7.0.1`, `actions/setup-node 4→7.0.0`, `actions/upload-artifact 4.6.2→7.0.1`, `docker/build-push-action 6.19.2→7.3.0`, `docker/login-action 3.7.0→4.6.0`, `docker/setup-buildx-action 3.12.0→4.3.0`, `pnpm/action-setup 4.4.0→6.0.10`
- **Riesgo:** Syntax `with:` cambió en algunos. Probar CI en branch antes de merge a `main`.
- **Branch sugerido:** `chore/actions-7`

### PR-F · `pdfjs-dist 6.0.227 → 6.2.x` — TECH_DEBT DT17 ⚪

- **Scope:** Pinneado exacto por worker mismatch (`edb9847`, `PDFViewerModal.svelte:52-56`). No tocar hasta que `@pdfslick/core` publique soporte para `pdfjs ≥6.2`.
- **Verificación cuando toque:** Branch `chore/pdfjs-6.2` + test manual del modal.

### Sueltos frescos (<24h, `minimumReleaseAge`)

- `zod 4.5.1 → 4.5.4` y `knip 6.33.0` ya disponibles tras Tanda 4/6 — entrarán solos en próximo `pnpm update` pasadas 24h sin forzar `minimumReleaseAgeExclude`.

## 7. Notas SvelteKit 3 y remote functions

- **v3 RC** 2026-08-13. Breakings: config en `vite.config.ts`, tipos a `$app/*`, `error(status, message)`, `refreshAll`, adapters reorganizados. Migrador: `npx sv@next migrate sveltekit-3 --tasks all`. No correr hasta stable.
- **Remote functions**: 28 archivos `.remote.ts`, ~90 consumidores. Siguen experimentales en v3 RC (`next.svelte.dev/docs/kit/remote-functions`). Estabilización prevista Svelte 6. Mantener wrapper fino `.server.ts` para rollback.
- Ya migrado: `$app/stores` → `$app/state` (0 vs 10 archivos). `defineEnvVars` no se usa.

## 8. Referencias

- `package.json:27-66` (devDeps/deps)
- `svelte.config.js:13-14` (remoteFunctions flag)
- `PLAN.md:DT7`, `PLAN.md:DT17`
- pnpm outdated 2026-08-27/28, Node 22.22.2, kit 2.69.2
- SvelteKit 3 RC blog 2026-08-13, `youngju.dev` snapshot next.8, `svelte.dev/blog/whats-new-in-svelte-august-2026`
