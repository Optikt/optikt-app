# Spec: chart-conventions

Scope: feature

# Chart Conventions (LayerChart)

Reusable conventions for any data visualization work in Optikt. Adopted via plan `layerchart-adopt`.

## Decision Record

- **Chosen:** LayerChart 2.x. Peer `svelte: ^5.0.0` (runes-native), official base of the shadcn-svelte chart recipe (copy-paste, no wrapper), Tailwind 4 compatible, subpath exports, no runtime CSS-in-JS.
- **Rejected:** `@unovis/svelte` — peer `svelte: ^4.0.0`, Svelte 5 upgrade still draft (f5/unovis#884, "Not part of 1.7"); `@unovis/ts` hard-depends on `three`, `leaflet`, `maplibre-gl`, `@emotion/css`.
- **Reconsider Unovis only if** maps/geo/network-graph visualizations become a hard requirement and its Svelte 5 upgrade has shipped.

## Install / Upgrade Rules

- Install `layerchart` from the `latest` dist-tag. **Never `@next`**: shadcn docs say `layerchart@next`, but dist-tag `next` (2.0.0-next.66) is older than `latest` (2.5.0).
- Pin exact version in `package.json`; LayerChart majors move fast and its `@layerstack/*` deps use prerelease ranges. Upgrade deliberately, one version at a time.
- Import from documented subpaths (`layerchart`, `layerchart/svg`, `layerchart/canvas`, `layerchart/hierarchy`, `layerchart/server`) to keep bundles tree-shaken.

## File Layout

- Primitives: `src/lib/components/ui/chart/` — `chart-container.svelte`, `chart-tooltip.svelte`, `chart-style.svelte`, `chart-utils.ts` (copied from shadcn-svelte, then owned locally).
- **No `index.ts` barrel** in that folder (repo no-barrels rule). Import each file directly.
- Domain charts: `src/lib/components/<domain>/` or `src/lib/components/reports/` (e.g. `SalesTrendChart.svelte`). Components accept plain data props; no DB access, no remote calls.

## Theming

- Colors are CSS variables `--chart-1..--chart-5`, registered via `@theme inline` in `src/routes/layout.css`, mapped to the brand palette (not shadcn defaults).
- Referenced in code as `var(--color-<key>)` via `chartConfig` (`src/lib/components/ui/chart/chart-utils.ts`).
- Enforce `design-ui.instructions.md`: color for meaning only, no decorative gradients, values in mono + `tabular-nums`, 150ms micro-animations, no spring/bounce, depth consistent with `glass-card`.
- Empty state required when a series has no data (reuse `EmptyState.svelte` or the chart-local equivalent).

## Data / Aggregation

- Read-only report aggregates live in `src/lib/server/db/queries/reports.ts`; each exports an explicit result type.
- Brand aggregation groups by the denormalized `saleItems.snapshotBrand` (`src/lib/server/db/schema/sales.ts`) and joins `products` to include only `ProductType.FRAME` and `ProductType.SUNGLASSES` (excludes accessories and contact lenses).
- Net line value: `max(0, unitPrice * quantity - discount)` where `discount` is `PERCENTAGE`-aware (`gross * discount / 100` for `PERCENTAGE`, flat otherwise). Mirrors `computeSaleTotals` in `src/lib/shared/saleTotals.ts`; never duplicate a divergent formula.
- Exclude `sales.deletedAt IS NOT NULL` and `sales.status = 'CANCELLED'` unless the chart explicitly reports cancellations.
- Sale-level global discount is not allocated per line; brand shares are pre-global-discount. Label or document accordingly.
- Data reaches pages through the existing pattern: `+page.server.ts` load for SSR/initial + remote `query` for refilter. Add fields to the existing result object instead of new round trips.
- Daily trend series can be derived in JS from the already-loaded sale list; fill the whole selected date range (zero-fill missing days), never only days with sales. Only push aggregation into SQL when row volume requires it (`date_trunc('day', ...)` precedent: `src/lib/server/db/queries/cash/daily.ts`).

## SSR / Rendering

- Charts render client-side. Start without guards; if hydration warnings or server errors appear, mount via `onMount`/`{#if browser}` or dynamic import rather than disabling SSR for the route.
- `layerchart/server` exists for server-side SVG rendering; only adopt it if a print/PDF need requires server-rendered charts.

## Testing

- Unit: pure helpers (line net, series shaping) in `*.spec.ts`.
- Integration: aggregation queries in `*.int.spec.ts` (testcontainers Postgres).
- Browser: `*.svelte.spec.ts` via the vitest client project (playwright/chromium) asserting SVG marks render for a fixture dataset.
- Gate every change with `pnpm check`, `pnpm lint`, `pnpm knip`, `pnpm test:unit`.

## Acceptance Criteria

- One chart library in `package.json` (LayerChart); no Unovis/three/leaflet/maplibre added.
- No new barrel files.
- Report page charts respect the active date range and status filter.
- Tokens resolve from brand palette in both light styling contexts used by the app.
- Existing report tables, CSV export and print flows unchanged.
