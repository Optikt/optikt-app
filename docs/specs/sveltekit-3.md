# Spec: sveltekit-3

Scope: repo

# Migración a SvelteKit 3

## Matriz objetivo

- `@sveltejs/kit` 3.1.x, `@sveltejs/adapter-node` 6.x, Vite >=8.0.12, Svelte >=5.57.1, `@sveltejs/vite-plugin-svelte` ^7.
- Node >=22.17 en runtime, CI y Docker.
- TypeScript `~6.0.3` (no `^6.0.3`: 6.1 rompe el peer `<6.1.0` de typescript-eslint). **TS7 no entra en esta migración**: Kit 3.1.0 declara peer `typescript: ^6.0.0`; `svelte-check@4.7.7` acepta `^5 || ^6`; `typescript-eslint@8.71.2` acepta `>=4.8.4 <6.1.0`. Subir a TS7 hoy rompe `pnpm check`/`pnpm lint`.

## Configuración

- `svelte.config.js` no existe. Toda la configuración (adapter, csrf, experimental.remoteFunctions, compilerOptions, preprocess) vive en `sveltekit({...})` dentro de `vite.config.ts`.
- `src/instrumentation.server.ts` se autodetecta; no usar `experimental.instrumentation`.
- `eslint.config.js` obtiene `svelteConfig` con `loadConfig` de `@sveltejs/load-config` (devDependency).

## Imports

- `$lib` eliminado. `package.json#imports` define `#lib` -> `./src/lib/index.js` y `#lib/*` -> `./src/lib/*`.
- Imports con extensión explícita: `.js` para módulos TS, `.svelte` para componentes, `index.js` para barrels existentes. No crear barrels nuevos.
- `#lib` es el único alias de app; no reintroducir `$lib` con aliases de Vite.

## Ambiente

- `$app/environment` -> `$app/env`; `$env/*` -> `$app/env/public` o `$app/env/private`.
- `src/env.ts` declara todas las variables con `defineEnvVars`; privadas por defecto, `public: true` solo si se usan en browser. `DATABASE_URL` requerido en runtime/build; opcionales con default seguro.
- `process.env` queda solo en scripts y casos documentados (`CHROMIUM_PATH` en `pdf.ts`).

## Paths y navegación

- `resolve('ruta')` sin `/` inicial para paths; los route IDs (`/[id]`, grupos) conservan `/`.
- `page.url` es readonly: helpers que reciben URL aceptan `{ href }` o `{ pathname, search }` y nunca mutan `page.url`.
- `invalidateAll` -> `refreshAll`; `goto({ invalidateAll })` -> `goto({ refreshAll })`. `keepFocus`/`noScroll` -> `reset: false` si aparecen. `goto` solo a rutas internas.
- No usar API de shallow routing; `history.replaceState` directo no es API de Kit.

## Remote forms (experimental)

- Todo control dentro de un `<form {...form.enhance(...)}>` usa atributos de `form.fields.<campo>.as(type, ...)`. Un `name` manual hace que Kit 3 rechace el submit.
- Inputs/textarea/select nativos: spread directo. Wrappers (`FormInput`, `FormTextarea`, etc.) reciben un `field` y hacen el spread interno; no duplicar `name`.
- Controles third-party (Svelecte, bits-ui Select/Combobox) que no aceptan spread: hidden input con `{...field.as('hidden', value)}` enlazado al valor del control; el control visual no lleva `name`. Este puente es deuda post-migración y debe registrarse por archivo/campo para limpiarse después.
- Checkbox/radio: `as('checkbox'|'radio', value, checked)`; hidden: `as('hidden', value)`; file: `as('file')`.
- Booleanos en schemas usados por `form()` deben ser opcionales/default (restricción de tipos de Kit 3).
- `event.url`, `event.params` y `event.route` no se usan dentro de `query()`; pasar argumentos explícitos.

## Errores

- `handleValidationError` eliminado. `handleError` recibe `kind: 'app' | 'framework' | 'validation' | 'unknown'`; validación trae `issues`. `App.Error` siempre incluye `status`.
- `handleError` no debe filtrar detalles sensibles; `error(...)` usa string como segundo argumento (extras en tercero).
- `json()`/`text()` deprecados: usar `Response.json()` / `new Response()`.

## Deploy

- adapter-node 6 elimina `ORIGIN`. Producción corre en `https://optikt.taild8f0b9.ts.net` (Dokploy + Tailnet): configurar `PROTOCOL_HEADER`/`HOST_HEADER` en el contenedor y verificar que el `Host`/`X-Forwarded-*` que recibe la app coincide con el origin público. Si el origin no se puede derivar, fijar `paths.origin` en build.
- Los assets estáticos se listan en build: no agregar archivos al output después del build.
- Node 22.17+ alineado en `.nvmrc`, Dockerfile, CI y `engines`.

## Gates

`pnpm check`, `pnpm lint`, `pnpm build`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm knip`. Cero `@migration-task`, cero `$lib`, cero `handleValidationError`, cero `$env/` en `src`.
