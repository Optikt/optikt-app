# Spec: cash-dash-qa

Scope: feature

# Feature: Aceptación split cash dashboard T2

Scope: feature
Vinculado a: dt1-t2-cashdash

## Objetivo

Descomponer `cash/+page.svelte` sin cambiar el reporte de caja.

## Alcance — Incluido

- 4 secciones en `src/lib/components/cash/` + `cashReport.ts`/`cashClasses.ts` con spec espejo.
- Queries intactas: `getCashReportQuery`, `getDailyBreakdownQuery`, `getPipelineQuery`; CSV idéntico.

## QA — Caja

- [ ] Filtros período + consultar recargan reporte, diario y pipeline; totales toolbar cuadran
- [ ] Resumen mobile/desktop: ingresos, COGS, otros, egresos, descuentos, variación, cobrado, bruta/neta, márgenes
- [ ] Pipeline: abiertas, facturado, anticipos, por cobrar, utilidad esperada; lectura rápida desktop
- [ ] Detalle diario mobile + tabla desktop: 11 columnas, signos/colores, vacíos
- [ ] CSV 11 columnas; print; link Gestionar egresos

## Gates

`pnpm check` 0, `pnpm lint`, `pnpm test:unit`, size sin FAIL en scope, `rg` cero imports rotos.
