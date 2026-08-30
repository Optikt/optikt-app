# Spec: dt1-split-protocol

Scope: repo

# DT1 · Protocolo de descomposición

## Umbrales

- Fuente: >500 líneas = monolito candidato (39 archivos, baseline 2026-08-30).
- Módulos extraídos: objetivo ≤300 líneas (stretch ≤200).
- Aceptación: cero archivos fuente >500 (specs de test pueden exceder si son data-driven, ver §7).

## Mecánica por tipo de archivo

1. **Componente .svelte monstruo:** extraer paneles/secciones a `<dominio>/<componente>/` con props tipadas + context del dominio; helpers puros → utils.
2. **Página +page.svelte:** patrón POC `componentize-purchase-detail` (2221→629): orquestador ~300-400 líneas + secciones en `components/<dominio>/detail/` + context de página.
3. **Remote \*.remote.ts:** split por recurso en carpeta `remote/<dominio>/` (`payments.remote.ts`, `items.remote.ts`, `queries.remote.ts`) + barrel `index.ts` re-exportando TODO lo existente → imports legacy siguen vivos; migrar consumidores gradualmente en PR separado.
4. **Queries server:** split por recurso (`queries/purchaseOrders/orders.ts`, `items.ts`, `payments.ts`, `review.ts`) + barrel. Mantener `executor: DbOrTx = db` en cada función (patrón AGENTS.md — no duplicar lógica inline).
5. **Helpers puros:** split por concern (ej. `saleItemHelpers` → items/pricing/prescription/tax). Tests espejo por módulo.
6. **Schemas:** `common.ts` (509) → `common/{currency,ids,dates}`; por dominio solo si >400.
7. **Specs:** espejo del split del fuente; `fifoScenarios.spec.ts` (600) → fixtures por escenario.

## Disciplina PR

- Un monolito por PR. Refactor puro: cero cambios de UX/comportamiento en el mismo PR.
- Barrel re-export conserva imports → diffs mínimos en fase 1.
- Migración de imports de consumidores = PR propio (mecánico, verificable con rg).

## Gates de verificación (cada PR)

1. `pnpm check` 0 errores
2. `pnpm lint` limpio
3. `pnpm test` verde (proyectos server + client de vitest)
4. `rg` confirma cero imports rotos al mover módulos
5. QA manual checklist del flujo tocado (documentado en PR)
6. Diff review: extracción sin lógica cambiada

## Size gate

- `scripts/check-file-size.sh`: falla si fuente >500 líneas; warn >300.
- CI: gate no-bloqueante (warn) hasta cerrar fases 1-5; bloqueante al final.

## Naming

- Carpetas kebab-case por dominio. Módulos: `<concern>.ts` (items.ts, pricing.ts, payments.ts).
- Context: `src/lib/context/<dominio>.ts`, exports `set<Dominio>Context`/`get<Dominio>Context`.
- Sin sufijos "Utils" nuevos — helpers viven en el dominio correspondiente.

## Orden de fases (detallado en plan `dt1-decompose`)

1. Helpers puros + tests (riesgo cero UI)
2. Payment strategy (flagship patrones)
3. T1 componentes, 1-PR cada uno
4. Remotes + queries server
5. Páginas T2
6. Espejo specs + gate bloqueante + PLAN.md ✅

## Riesgos y mitigación

- **Import churn** → barrels (§3), PRs separados.
- **Reactividad Svelte 5 en extractos** → getters/funciones reactivas vía context; svelte-autofixer en cada componente nuevo.
- **Sin tests remotes (DT9)** → solo helpers puros se mueven sin red; orquestación remotes se parte sin cambiar lógica (diff review estricto).
- **Conflicto FP3** (public-catalog-api toca `ProductForm.svelte`:931) → descomponer ProductForm ANTES del widget de imágenes FP3, o coordinar ramas para evitar merge hell.