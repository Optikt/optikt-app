---
plan name: dt1-t2-cashdash
plan description: Descomponer cash dashboard T2
plan status: active
---

## Idea
Descomponer `src/routes/(app)/cash/+page.svelte` (851 líneas) con patrón orquestador: página ~80 + 4 secciones en `src/lib/components/cash/` (CashToolbar, CashSummary, CashPipeline, CashDailyTable) + `cashReport.ts` puro (formatPct, buildCashCsvRows) + `cashClasses.ts` (tokens display compartidos) con spec espejo. Cero cambios UX. Queries (report, daily, pipeline) y CSV intactos en la página.

## Implementation
- Crear rama chore/dt1-t2-cash-dashboard y mapear secciones cash
- Extraer cashReport.ts + cashClasses.ts + spec espejo
- Crear CashToolbar/CashSummary/CashPipeline/CashDailyTable y cablear página ~80
- Gates check/lint/test + size gate + QA cash + plan/spec docs + PR
- Push rama y reportar QA checklist

## Required Specs
<!-- SPECS_START -->
- dt1-patterns
- dt1-split-protocol
- dt1-payment-strategy
- public-catalog-arch
- sale-subtotal-semantics
- cash-dash-qa
<!-- SPECS_END -->