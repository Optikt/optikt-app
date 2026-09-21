---
plan name: layerchart-adopt
plan description: Charts LayerChart en reportes
plan status: active
---

## Idea
Adoptar LayerChart 2.x como libreria oficial de charts y hacer spike en /reports/sales con dos visualizaciones: linea de tendencia diaria y barras horizontales por marca. Evidencia: layerchart 2.5.0 declara peer svelte ^5.0.0 (runes-native), es la base de la receta oficial de charts de shadcn-svelte (copy-paste, sin wrapper, encaja con components.json y $lib/components/ui), expone subpaths de import ./svg ./canvas ./server ./hierarchy (alineado con regla no-barrels) y no trae runtime CSS-in-JS ni renderers pesados. Unovis queda descartado: @unovis/svelte 1.7.0 mantiene peer svelte ^4.0.0 y su upgrade a Svelte 5 es PR draft #884 marcado "Not part of 1.7"; ademas @unovis/ts hard-depende de three, leaflet, maplibre-gl y @emotion/css. Datos: reportes usan getReportSales (src/lib/server/db/queries/reports.ts:110) via load + remote fetchSalesReport (src/lib/remote/reports.remote.ts:41); saleItems tiene snapshotBrand denormalizado (schema/sales.ts:180) para agregar por marca sin joins extra. Instalar latest (2.5.0), NO @next (dist-tag next=2.0.0-next.66 es mas viejo que latest).

## Implementation
- Instalar layerchart latest (2.5.0, no @next) con pnpm; verificar peer svelte ^5.0.0 y correr pnpm check
- Agregar tokens --chart-1..--chart-5 mapeados a la paleta de marca en src/routes/layout.css y registrarlos con @theme inline
- Copiar primitivas chart de shadcn-svelte a src/lib/components/ui/chart/ (container, tooltip, style, utils) sin index.ts barrel: imports directos por archivo
- Agregar getReportSalesByBrand(dateFrom, dateTo) en src/lib/server/db/queries/reports.ts: agregar sobre saleItems join sales, snapshotBrand, itemType PRODUCT, excluir CANCELLED/deleted, linea neta max(0, unitPrice*quantity - descuento), order desc limit 8; exportar tipo BrandSalesSlice y sumar byBrand al retorno de getReportSales
- Actualizar tipos/plumbing: SalesReportResult en src/lib/remote/reports.remote.ts, load en src/routes/(app)/reports/sales/+page.server.ts (sin round trip extra en applyFilter)
- Crear src/lib/components/reports/SalesTrendChart.svelte: serie diaria derivada de filteredSales, LineChart/AreaChart de LayerChart con Chart.Container y Chart.Tooltip, valores mono tabular-nums
- Crear src/lib/components/reports/SalesByBrandChart.svelte: barras horizontales desde byBrand, empty state si no hay datos, animacion 150ms sin bounce y sin gradientes decorativos
- Integrar ambos charts en src/routes/(app)/reports/sales/+page.svelte respetando statusFilter y el flujo load + fetchSalesReport; guard client-only si aparece warning de SSR/hidratacion
- Tests: unit del helper de linea neta si se extrae a $lib/shared, integration *.int.spec.ts para getReportSalesByBrand, browser .svelte.spec.ts verificando que el SVG renderiza marcas; correr pnpm check, pnpm lint, pnpm knip y pnpm test:unit

## Required Specs
<!-- SPECS_START -->
- dt9-test-harness
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- chart-conventions
<!-- SPECS_END -->