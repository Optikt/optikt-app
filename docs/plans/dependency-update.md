# Plan: Actualización de Dependencias (2026-08-27 → 2026-08-29) — HISTÓRICO

> Evaluación completa `pnpm outdated` + SvelteKit 3 RC + remote functions. **Completado y mergeado a `main`:** `chore/deps-2026-08` (Tandas 1-6) + PR-A (`auth`) + PR-C (`lucide`) + PR-D (`puppeteer`) + PR-E (`Actions`).
> Contexto: `PLAN.md:DT17` pinneó `pdfjs-dist + @pdfslick/core` — fuera de scope.
> **Estado final `main` 2026-08-29:** `pnpm outdated` 5 filas, todas **fuera de scope** (ver §6). Histórico 2026-08-28: 37 pendientes → 2026-08-29: 5 pendientes.

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

## 5. Checklist — Estado final 2026-08-29 (mergeado a `main`)

- [x] Branch `chore/deps-2026-08` creado, DT17 pinneado (`pdfjs-dist 6.0.227 exact`, `@pdfslick/core 4.0.0 exact` / `PLAN.md:DT17`) → mergeado `4e2dc41` — **en `main`**
- [x] Tanda 1 — tooling · `26dbeaf` — `prettier 3.9.6, eslint 10.9.1, eslint-plugin-svelte 3.23.0, typescript-eslint 8.68.0, globals 17.11.0, knip 6.32.3→6.33.0, svelte-doctor 0.3.7, tsx 4.23.12` → check 0, build 36s, 771 tests
- [x] Tanda 2 — styling · `9347b74` — `tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, prettier-plugin-tailwindcss 0.8.1, tailwind-variants 3.3.1` → check 0, build 1m15s, 771 tests
- [x] Tanda 3 — runtime UI · `374724c` + `414213b` — `bits-ui 2.19.0, svelte-sonner 1.2.1, @internationalized/date 3.12.3, export-to-csv 1.5.0, libphonenumber-js 1.13.12, @node-rs/argon2 2.2.0` → check 0, build 1m23s, 771 tests
- [x] Tanda 4 — validación · `bef338e` — `zod 4.3.6→4.5.1, svelte-check 4.7.2→4.7.6` → check 0, build 36.9s, 771 tests
- [x] Tanda 5 — framework core · `5e6a035` + `381931b` — `@sveltejs/kit 2.69.2→2.70.3, svelte 5.56.4→5.57.0, @sveltejs/vite-plugin-svelte 7.2.0→7.3.0, vite 8.1.4→8.2.2` → check 0, build 1m02s→3m07s, 771 tests
- [x] Tanda 6 — test infra · `2e9003c` — `vitest 4.1.11, @vitest/browser-playwright 4.1.11, @playwright/test 1.62.1, playwright 1.62.1` → check 0, build 35s, 771 tests
- [x] PR-A — `@oslojs/crypto` → `node:crypto` · `a917945` → merge `190de59` (#99)
- [x] PR-C — `@lucide/svelte 0.577.0→1.37.0` · `d1e0e8a` → merge `7d1ebe6` (#102)
- [x] PR-D — `puppeteer-core 25.3.0→25.9.0` · `9c2d681` → merge `019fa94` (#101)
- [x] PR-E — Actions `4→7` · `37ea3ba` → merge `e518b6a`

Todas las tandas en `main`. `pnpm outdated` final: 5 filas fuera de scope (ver §6).

## 6. PRs separados — TODO CON CUIDADO

> `chore/deps-2026-08` (Tandas 1-6), PR-A y PR-E ya en `main`. Restan abajo, cada uno branch + PR propio. No mezclar.

### PR-A · `@oslojs/crypto` → `node:crypto` — MERGEADO ✅ (#99 `a917945` → `190de59`)

- **Scope:** `src/lib/server/auth.ts:2` (`sha256` deprecated) — 1 import, hashing de sesión.
- **Hecho:** `createHash('sha256')` de `node:crypto`, quitada dep `@oslojs/crypto`, `check 0, build 34s, 771 tests`, SHA256 parity `hello → 2cf24dba...` verificado. `@oslojs/encoding` (`1.1.0`) se queda.

### PR-B · `typescript 6.0.3 → 7.0.2` — FUERA DE SCOPE 🔴

- **Por qué no se toca:** `typescript@7` es major que exige `SvelteKit 3` stable. `svelte-check 4.7.6` y `typescript-eslint 8.68.0` aún no tienen soporte TS7. Actualizar ahora rompe `pnpm check`.
- **Regla:** Queda en `6.0.3` hasta que salga Kit 3 stable. Entonces branch `chore/typescript-7` con Kit 3 + TS7 juntos. No hay beneficio en subir solo TS.

### PR-C · `@lucide/svelte 0.577.0 → 1.37.0` — MERGEADO ✅ (#102 `d1e0e8a` → `7d1ebe6`)

- **Hecho:** Major `0→1` (150+ icons). `check 0, build 33s, 771 tests`, sin errores de tipo. QA visual OK.

### PR-D · `puppeteer-core 25.3.0 → 25.9.0` — MERGEADO ✅ (#101 `9c2d681` → `019fa94`)

- **Hecho:** Bump `25.9.0`, `check 0, build 33s, 771 tests`. `@sparticuz/chromium` queda `149.0.0` (prod usa `apk add chromium`).

### PR-E · GitHub Actions `4 → 7` — MERGEADO ✅ (`37ea3ba` → `e518b6a`)

- **Hecho:** 5 workflows — `actions/checkout 7, setup-node 7, upload-artifact 7, docker/setup-buildx 4, login 4, build-push 7, pnpm 6`.

### PR-F · `pdfjs-dist 6.0.227 → 6.2.x` — FUERA DE SCOPE ⚪ (DT17)

- **Por qué no se toca:** Funciona ahora (viewer + `puppeteer` server). Worker mismatch histórico `edb9847` si se sube a `6.2`. Hay que tomar decisión: ¿mantener pinneado o buscar otra forma de ver PDFs (ej. visor nativo, `pdf.js` sin `@pdfslick/core`)? Por ahora **no se toca** — costo/beneficio no compensa. Revisitar solo si `@pdfslick/core` publica soporte `pdfjs ≥6.2`.
- **Estado:** Pinneado exacto `pdfjs-dist 6.0.227` + `@pdfslick/core 4.0.0` sin `^` ( `PLAN.md:DT17` ).

### `@types/node 22 → 26.4.0` — FUERA DE SCOPE ⚪

- **Por qué no se toca:** Runtime es `Node 22.22.2`. `@types/node` debe matchear runtime. Subir a `26` sin bump de Node no aporta nada y puede ocultar incompatibilidades. Se queda en `^22` a menos que hagamos **bump explícito de Node** (ej. `node:24` o `26`).

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
