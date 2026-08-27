# Plan: Actualización de Dependencias (2026-08-27)

> Evaluación completa `pnpm outdated` + SvelteKit 3 RC + remote functions. Trabajo diferido a otro PC.
> Contexto: `PLAN.md:DT17` pinneó `pdfjs-dist` — ese paquete queda fuera de este plan.

## 1. Snapshot actual

| Paquete | Instalado | Latest | Tipo |
|---|---|---|---|
| `@sveltejs/kit` | 2.69.2 | 2.70.3 | patch |
| `svelte` | 5.56.4 | 5.56.10 | patch |
| `@sveltejs/vite-plugin-svelte` | 7.2.0 | 7.3.0 | minor |
| `vite` | 8.1.4 | 8.2.2 | minor |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.2 | 4.3.3 | patch |
| `bits-ui` | 2.18.1 | 2.19.0 | minor |
| `zod` | 4.3.6 | 4.4.3 | minor |
| `drizzle-orm` | 0.45.2 | 0.45.2 | al día |
| `knip` | 6.27.0 | 6.32.2 | minor |
| `svelte-doctor` | 0.3.1 | 0.3.6 | patch |
| `eslint` | 10.7.0 | 10.9.1 | patch |
| `typescript-eslint` | 8.63.0 | 8.68.0 | minor |
| `prettier` | 3.9.5 | 3.9.6 | patch |
| `eslint-plugin-svelte` | 3.20.0 | 3.23.0 | minor |
| `globals` | 17.7.0 | 17.11.0 | minor |
| `playwright` / `@playwright/test` | 1.61.1 | 1.62.1 | minor |
| `puppeteer-core` | 25.3.0 | 25.8.0 | minor |
| `pdfjs-dist` | 6.0.227 (pinneado exacto) | 6.2.108 | **NO TOCAR — DT17** |
| `@pdfslick/core` | 4.0.0 (pinneado exacto) | 4.0.2 | **NO TOCAR — DT17** |
| `svelecte` | 5.3.0 | 5.3.0 | al día |
| `svelte-doctor` | 0.3.1 | 0.3.6 | — |
| `lilmolly` | 1.3.7 | 1.3.7 | al día |
| `@sparticuz/chromium` | 149.0.0 | 149.0.0 | al día |
| `@types/node` | ^22 | 26.3.0 | **NO TOCAR** (runtime es Node 22.22.2) |
| `@oslojs/crypto` | 1.0.1 | Deprecated | **Reemplazar** |
| GitHub Actions | checkout 4 / setup-node 4 | 7 | major diferido |

## 2. Qué NO tocar en este ciclo

- **`pdfjs-dist` + `@pdfslick/core`**: pinneados exactos por `DT17`. Worker mismatch histórico (`edb9847`). Solo revisitar cuando upstream soporte pdfjs ≥6.2.
- **`@types/node`**: quedarse en `^22` — debe matchear runtime (`node --version` = 22.22.2), no latest 26.
- **`puppeteer-core` / `@sparticuz/chromium`**: el `500 libnspr4.so` de 2026-08-27 fue fallo de entorno dev (falta `libnspr4`/`libnss3` en host `100.122.162.118`), no de versión. En prod funciona (Docker `apk add chromium`). Actualizar este par requiere re-validar `src/lib/server/pdf.ts` + `CHROMIUM_PATH` — fuera de scope de este plan.
- **SvelteKit 3**: RC desde 2026-08-13 (`3.0.0-next.25`). No migrar hasta stable. Remote functions siguen experimentales incluso en v3 (requieren `kit.experimental.remoteFunctions` + `compilerOptions.experimental.async`; `async` se quita recién en Svelte 6). Ver sección 4.

## 3. Trabajo propuesto (orden)

### Fase A — Seguro, hacer primero (30 min)

```bash
pnpm update svelte @sveltejs/kit @sveltejs/vite-plugin-svelte vite tailwindcss @tailwindcss/vite \
  bits-ui zod drizzle-kit knip svelte-doctor eslint typescript-eslint prettier eslint-plugin-svelte \
  globals @playwright/test playwright
# Verificar:
pnpm check          # 0 errors
pnpm build          # ~45s, warnings circulares @internationalized/date pre-existentes
pnpm test:unit      # 758+ tests
# E2E si aplica: pnpm test:e2e
```

Cada paquete es patch/minor sin breaking. Hacer en un solo commit `chore: bump deps within semver (safe minors/patches)`.

### Fase B — Reemplazo `@oslojs/crypto` (30 min)

- `src/lib/server/auth.ts:2` usa `sha256` de `@oslojs/crypto` (deprecated: "Package no longer supported").
- Reemplazar por `node:crypto` (`createHash('sha256')`). `@oslojs/encoding` (`1.1.0`) aún no deprecado, puede quedarse.
- Quitar `@oslojs/crypto` del `package.json`, `pnpm install`, `pnpm check`.

### Fase C — Diferido / manual

- **GitHub Actions**: `actions/checkout@4 → 7`, `actions/setup-node@4 → 7` — major, revisar changelog en `.github/workflows/tests.yml` antes.
- **`@types/node@26`**: solo cuando se migre runtime a Node 26.
- **`puppeteer-core@25.8.0`**: probarlo solo junto con validación de `generatePdf()` local + docker.
- **SvelteKit 3**: esperar stable, luego `npx sv@next migrate sveltekit-3 --tasks all`. Impacto en este repo estimado: `svelte.config.js` → `vite.config.ts`, `error()` con message requerido (82 calls), `invalidateAll` → `refreshAll` (9 refs), tipos `RequestEvent` → `$app/server`. Plan separado.

## 4. Notas sobre SvelteKit 3 y remote functions

- **v3 RC** publicado 2026-08-13. Breaking changes: config en `vite.config.ts`, tipos movidos a `$app/*`, `error(status, message)`, `refreshAll`, adapters reorganizados. Migrador automático disponible pero no correr aún.
- **Remote functions**: 28 archivos `.remote.ts`, ~90 consumidores. Siguen experimentales en v3 RC (`next.svelte.dev/docs/kit/remote-functions` exige ambos flags). Estabilización prevista para Svelte 6, no para Kit 3. No hay urgencia — seguir con patrón `.server.ts` debajo como wrapper fino permite rollback.
- Ya migrado: `$app/stores` → `$app/state` (0 vs 10 archivos). `defineEnvVars` no se usa.

## 5. Checklist para el otro PC

- [ ] Fase A: bump + check + build + test:unit
- [ ] Fase B: reemplazar `@oslojs/crypto`
- [ ] Commit + push a `main` (o branch `chore/deps-2026-08`)
- [ ] Verificar `/api/pdf/sale/...` sigue 200 (descarta regresión de `puppeteer`)

## 6. Referencias

- `package.json:27-66` (devDeps/deps)
- `svelte.config.js:13-14` (remoteFunctions flag)
- `PLAN.md:DT7`, `PLAN.md:DT17`
- pnpm outdated 2026-08-27, Node 22.22.2, vite 8.x, kit 2.69.2
- SvelteKit 3 RC blog 2026-08-13, `youngju.dev` snapshot next.8, `svelte.dev/blog/whats-new-in-svelte-august-2026`
