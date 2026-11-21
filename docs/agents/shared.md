# shared (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc cubre solo el layer cross-cutting.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Código usado por dos o más dominios o por cliente+servidor, sin reglas de negocio exclusivas de un dominio: base UI, documento comercial compartido, primitivas Zod, audit y hooks del framework. Nada acá debe saber de negocio de un solo dominio — si un archivo gana reglas de un solo dominio, se traslada a la lógica pura de ese dominio (ver excepciones de `src/lib/shared/` en root AGENTS.md).

## Scope

- `src/lib/components/ui/**` (componentes base), `layout/**`, `commercialDocument/**`, `documentEditor/**`, `branding/**`, `background/**` (nota: `components/forms/**` = login, pertenece a `users`)
- `src/lib/schemas/common/**` (contacts/dates/identity/numbers/optical/pagination) + `schemas/search.ts` + `schemas/index.ts`
- `src/lib/server/audit/**`, `documentTotals.ts`, `treatmentValidation.ts`, `server/db/{index,types,search}.ts`, `server/db/schema/{utils,index}.ts`
- `src/lib/actions/**`, `context/**`, `dates.ts`, `utils/**`, `stores/**`, `types/**`
- `src/hooks.server.ts`, `src/hooks.client.ts`, `src/app.{html,d.ts}`
- Resto de `src/lib/shared/` (enums, `contracts/**`, `tax.ts`, `exchangeRates.ts`, `notifications.ts`, soporte a varios dominios), **excepto** la lógica pura por dominio: `saleTotals*`/`saleItemCosts*`/`tickera*`/`ticketRate*` → `sales`; `purchaseOrder*` → `purchases`; `payments/**` → `payments`; `expenseCalculations*` → `cash`; `prescriptionSnapshot*` → `prescriptions`.

## Reglas de dominio / invarianzas

- **Audit** (`server/audit/auditService.ts`): contexto via `getAuditContext()` (`userId`, `ipAddress`, `userAgent` del evento actual, `:28`). API: `logCreate/logUpdate/logDelete/logRestore/logCustom`. `logUpdate` calcula diff old→new y **no registra si nada cambió** (`hasChanges`, `:89`). `excludeFields` recorta; `includeSnapshot` guarda el estado entero (usar con moderación). Insert directo a `change_history` (`:195`) — **nunca dentro de la transacción** de negocio (regla global del root).
- **`server/documentTotals.ts`**: único lugar que recalcula totales de documento comercial en servidor. No re-implementar aritmética subtotal/descuento/impuesto inline en otro lado.
- **`hooks.server.ts`**: sesión validada por-request (`handleAuth`, `:20`); cookie se borra si la sesión expiró. `ServerInit` arranca el poller de tasas (`:16`) — NO moverlo a import-time (ver comentario: en prod el env dynamic llegaba vacío y las tasas congelaban). `handleValidationError` (`:89`) centraliza la traducción de issues Zod a mensaje humano.
- **`src/lib/dates.ts`**: toda manipulación de fechas pasa por acá (`nowISO()`); no usar `new Date().toISOString()` sueltos ni aritmética de timezone ad-hoc.
- **Schemas primitivos** (`schemas/common/`): cuando el schema de un dominio repite un patrón de una primitiva, componer desde `common/`, no copiar.
- **`components/ui/**`**: los componentes base se importan de `$lib/components/ui/`, nunca se copian a un dominio. `components/index.ts` es barrel legacy: consumible por código existente, no extendible (regla global No Barrels). Extender un kit-component solo con **props opcionales** que no cambien a los consumidores actuales (ej.: `SegmentedToggle` ganó `variant: 'default'|'light'`, `icon` por opción y `class` — el default sigue idéntico — más `role=tablist` + navegación con flechas; `SaleStatusBadge` ganó `label` y `class`). Igual criterio para los componentes de `sales` generalizados con quotes (`SaleListHeader`, `SaleFilterBar`, `SaleStatusTabs`, `SaleListFooter`, `SaleItemsTable`, `EditSaleModal` y sus piezas).
- **Hero navy compartido (plan quotes-redesign):** `src/lib/components/layout/heroNavy.css` es la fuente única del grid por áreas, franjas, `.hero-btn` y sus container queries; lo importan `sales/detail/SaleDetailHero.svelte` y `quotes/detail/QuoteDetailHero.svelte`. Todas las reglas cuelgan de la clase raíz `.navy-hero` para no ensuciar el scope global con `.hero`, `.mon`, `.hl`, `.acts`. No duplicar ese CSS en los dominios. Las reglas repo-wide de la X sobre navy y de los umbrales 390/1280/2560 están en `.github/instructions/design-ui.instructions.md`.
- **Totales/costos compartidos:** `toSaleTotalsLine` (`shared/saleTotals.ts`) y `resolveLensSnapshotCosts` (`shared/saleItemCosts.ts`) son la fuente única para ventas y quotes (antes duplicados en `remote/quotes/helpers.ts` y `remote/sales/helpers.ts`; ambos duplicados eliminados).
- **`components/ui/**`**: los componentes base se importan de `$lib/components/ui/`, nunca se copian a un dominio. `components/index.ts` es barrel legacy: consumible por código existente, no extendible (regla global No Barrels). Extender un kit-component solo con **props opcionales** que no cambien a los consumidores actuales (ej.: `SegmentedToggle` ganó `variant: 'default'|'light'`, `icon` por opción y `class` — el default sigue idéntico — más `role=tablist` + navegación con flechas; `SaleStatusBadge` ganó `label` y `class`).
- **Kit móvil** (plan `sales-list-mobile`): piezas compartidas, NO duplicar por sección. `SlideOver` soporta `direction="bottom"` con `dragClose` (asa arrastrable > 90 px cierra; `pointercancel` suelta el gesto sin cerrar) y safe-area inferior (`env(safe-area-inset-bottom)`); el **velo solo cierra con `closeOnVeil` opt-in** (hojas móviles; los drawers con formulario quedan en false para no perder cambios). `ScrollableRow` = fila de píldoras desplazable (una línea, máscara de desvanecimiento a la derecha, re-alinea el hijo `[data-active]` cuando cambia `activeKey`). `Carousel` = scroll-snap horizontal genérico (`<script generics="T">`, `items` + snippet `item`, indicador de puntos que sigue al scroll). `Fab` = FAB extendido (label arriba, contraído > 60 px, oculto al bajar rápido; recibe la ruta cruda y la resuelve UNA vez). `SegmentedToggle` ganó `iconOnly` (44 px, label sr-only). ⚠️ `fixed` + `container-type` son incompatibles: toda pieza `fixed` (FAB, hojas, barra móvil) debe montarse FUERA de contenedores `@container`. `utils/scroll.ts:getAppMainScroll()` es el contenedor de scroll único (el `<main>` del layout). El filtro global de `ResizeObserver loop` en `+layout.svelte` es decisión deliberada: ruido benigno del navegador, no un fallo de la app.
- **Búsqueda global** (`layout/`): la lógica vive en `universalSearch.svelte.ts` (`createUniversalSearch`: debounce 250 ms + remote `universalSearch`) y los resultados en `SearchResultsList` — consumidos por `CommandSearch` (escritorio, inline ≥lg) y `MobileGlobalSearch` (móvil <lg: icono de lupa → campo a ancho completo con foco + panel de ayuda/chips de ejemplo + velo; cierra con ✕/velo/Esc). No reimplementar la búsqueda en otra pieza.
- **`utils/urlState.ts`**: `replaceUrlSearch` usa el wrapper `replaceState` de `$app/navigation` (no `history.replaceState` crudo: SvelteKit lo advierte y rompe su router). Contrato: replace sin entradas de historial.
- **`commercialDocument/`** es la capa compartida de fila de documento (ventas/cotizaciones): items, qty, descuento. Reglas exclusivas de un dominio van en el doc de ese dominio, no acá.

## Patrones locales

- Unit specs co-ubicadas junto al archivo (`*.spec.ts`), corren con `pnpm test:unit` (project server + client).
- **Motion** (`routes/layout.css`): keyframes `rise-in`/`pop-in` con utilidades `.animate-rise` / `.animate-pop` (duración y easing salen de los tokens `--ds-*`); el stagger se hace con `style="animation-delay: {i * N}ms"`. Una regla global `@media (prefers-reduced-motion: reduce)` desactiva animaciones y transiciones en toda la app — reutilizar en vez de agregar keyframes por página.
- Tests de integración de query fns: `int.spec.ts` co-ubicado, corren contra Postgres real vía `scripts/run-integration-tests.mjs` (`pnpm test:integration`).
- `src/lib/shared/` = frontera client/server: lógica idéntica a ambos lados vive ahí; lo que es solo-cliente va a `utils/`, solo-servidor a `src/lib/server/`.
- Conteo Físico (archivos en shared, reglas del dominio `inventory`): `countLineSaveQueue.ts` = cola de guardado «último valor gana» (un envío por línea, líneas distintas en paralelo, el caller aporta el `Set` in-flight como `$state`); `countSessionPhase.ts` = fases/CTA/stepper + `buildDiffRows`; `inventoryCount.ts` = math del ciclo. Specs co-ubicados.

- `commercialDocument/DocumentItemRow` acepta `extra` (snippet bajo la descripción; sus clics no abren la fila) — lo usa el chip "PARA" de la agrupación por persona en el drawer de edición.

## Known gaps / tech debt

- 🟡 Barrels legacy además de los listados: `schemas/index.ts`, `remote/index.ts`, `utils/index.ts`, `audit/index.ts` — consumibles, no extendibles; eliminar en futuras limpiezas.
- 🟠 `documentEditor/` (lensEditor, opticalRange) es shared pero pesado de óptica específica de venta/cotización de cristales — candidato a mover al dominio `lenses` a mediano plazo.
- 🟡 Cobertura de tests unitarios de componentes `ui/**` casi nula (solo `EmptyState.svelte.spec.ts`).

## Testing

- `.spec.ts` co-ubicado es el estándar; `.test.ts` existe como legacy (`tax.test.ts`) — no repliques.
- Deliberado que NO todos los dominios tienen `int.spec.ts`: solo query fns con escrituras/lecturas monetarias o de inventario — sigue ese criterio en vez de "todos los archivos".

## Planes completados

- **2026-11 · sales-list-mobile** — Kit móvil compartido (SlideOver drag-close, ScrollableRow, Carousel, Fab, búsqueda global plegable <lg con lógica compartida) + NavLink min-h-11 + urlState con wrapper replaceState (#228)
- **2026-11 · agents-md-por-dominio** — Doc por dominio: índice machine-readable (scripts/agents-domains.json), plantilla, check CI y sembrado core
- **2026-11 · dt1-decompose** — Programa de descomposición de 39 archivos >500 líneas: completado, gate check-file-size bloqueante en CI (PRs #120-#151)
- **2026-11 · dt1-t1-split** — Split de los 3 monolitos T1: EditSaleModal 499, LensCatalogForm 463, inventory/count/[id] 513, bajo el gate 520
- **2026-11 · dt9-remote-tests** — Cobertura de remote functions: harness Testcontainers, 14 cores shell/core contra DB real, 7 E2E sin skips, coverage ratchet en CI (#156-#173)
- **2026-11 · dt9-unit-e2e** — Mismo programa DT9 (doc espejo; cierre en dt9-remote-tests)
- **2026-11 · date-tz-normalize** — Normalización de fechas TZ (expenseDate date-only intencional)
- **2026-11 · dead-code-cleanup** — Limpieza de código muerto verificado con Knip
- **2026-11 · dependency-update** — Actualización de dependencias en tandas (2026-08); restantes deferidas en PLAN.md
- **2026-11 · dt12-table-migrate** — DataTable y DataGrid consolidados (uno solo, el otro eliminado)
- **2026-11 · preserve-list-filters** — Filtros de listado preservados al volver de un detalle
