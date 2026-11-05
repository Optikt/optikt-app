# reports (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Reportes read-only (ventas, pagos, inventario de cristales) con resúmenes agregados y charts LayerChart. Convenciones de charts: `docs/specs/chart-conventions.md`; plan de adopción `layerchart-adopt` (done).

## Scope

`components/reports/**`, `routes/(app)/reports/**`, `remote/reports.remote.ts`, `queries/reports.ts` (+ `reports.int.spec.ts`), `schemas/reports*`.

## Reglas de dominio / invarianzas

- Solo lectura; cada query exporta su tipo explícito (`ReportSale`, `PaymentsReportSummary`, etc.).
- ⚠️ **Reembolsos en el reporte de pagos**: `grossBcvUsd` = pagos activos **+ pagos de ventas canceladas con anticipos RETAINED** (dinero real que entró); `refundedBcvUsd` es **informativo, no se resta** del gross (`queries/reports.ts:83-94,302-306`). No "corregir" el gross.
- Brand chart: solo `itemType=PRODUCT` de tipo FRAME|SUNGLASSES, agrupado por snapshot denormalizado `saleItems.snapshotBrand`, excluye CANCELLED + deleted; línea neta `max(0, unitPrice×qty − desc)` respetando PERCENTAGE; **shares pre-descuento-global** (no se alocan por línea); limit 8 (`reports.ts:151,157-194`).
- Fechas: ventas por `sales.createdAt`; pagos por `salePayments.paymentDate`; refunds por `cancelledAt`.

## Patrones locales

- Charts client-only con componentes palette-token en `components/ui/chart/` (sin barrel); tokens `--chart-1..5` mapeados a la paleta de marca con `@theme inline`. Los componentes de dominio reciben datos plain (sin DB/remote).
- SSR inicial + refiltro remote (`fetchSalesReport`) reutilizando el mismo result object, sin round-trips extra; serie diaria cero-rellenada en JS (`eachISODay`).
- Reusables: `DateRangeFilter` + `ReportHeader` (el único barrel residual de este dominio, `components/reports/index.ts` — consumible, no extendible).

## Testing

- `reports.int.spec.ts` (testcontainers): brand-net con descuentos, exclusión CANCELLED/accesorios/lentes, range, limit.
- `*.svelte.spec.ts` browser (vitest-browser-svelte) para SVG y empty states de ambos charts.

## Known gaps / tech debt

- 🟡 `DateRangeSchema` sin validar orden `from ≤ to` (`schemas/reports.ts:6-9`).
- 🟠 El resumen de pagos duplica la regla de negocio de reembolsos/retenciones (misma lógica que el P&L de `cash`) — si la tocas, sync con el doc `cash`; candidata a extraerse a un spec.
