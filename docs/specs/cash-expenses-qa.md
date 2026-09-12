# Spec: cash-expenses-qa

Scope: feature

# Feature: Aceptación split cash expenses T2

Scope: feature
Vinculado a: dt1-t2-cash

## Objetivo

Descomponer `cash/expenses/+page.svelte` sin cambiar comportamiento del flujo de egresos.

## Alcance — Incluido

- 4 secciones en `src/lib/components/cash/` + `expenseForm.ts` puro con spec espejo.
- Remotes intactos: `listExpensesQuery`, `createExpenseCommand`, `voidExpenseCommand`, `fetchLatestRates`.
- Validaciones de submit y motivo de anulación idénticas.

## QA — Egresos

- [ ] Filtros fecha/categoría/anulados + aplicar; línea de filtro activo; CSV con 11 columnas; print
- [ ] Resumen mobile/desktop: total, cantidad, categoría, rango
- [ ] Tabla desktop + cards mobile: estados activo/anulado, motivo, tasas; anular pide motivo ≥5
- [ ] Crear: prefill BCV/USDT, hints aplicables, preview USD BCV, validaciones monto/tasa, éxito refresca lista
- [ ] Monedas con/sin tasa (USD vs VES/USDT): campos condicionales + tipo de tasa

## Gates

`pnpm check` 0, `pnpm lint`, `pnpm test:unit`, size sin FAIL en scope, `rg` cero imports rotos.