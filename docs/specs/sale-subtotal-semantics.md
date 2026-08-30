# Spec: sale-subtotal-semantics

Scope: repo

# Spec: Subtotales pre-impuesto en ventas y presupuestos

## Contexto

Las columnas `sales.subtotal` y `quotes.subtotal` guardan la suma **cruda de líneas con IVA incluido** (ej. 122 = 87 montura + 35 cristal), lo que hace `subtotal = total` cuando no hay descuento. La semántica correcta (ya usada en el card del wizard y en print): `subtotal` = **BI + Exento** = suma pre-impuesto (base imponible de líneas gravables + valor completo de líneas exentas), tras descuentos por línea y **antes** del descuento global.

**Regla de oro:** `total` (monto cobrado) NO cambia. `total = rawSubtotal − descuento global` — exactamente el mismo número que se genera hoy. Cero impacto en caja, reportes, recibos, prints, dashboard (todos usan `sales.total`).

## Fórmulas

Para cada línea con descuento por línea aplicado:
- `gross = unitPrice × quantity`
- `lineDiscount = PERCENTAGE ? gross × discount/100 : discount`
- `line = max(0, gross − lineDiscount)` (crudo, con IVA para gravables)
- `rawSubtotal = Σ line` (base del descuento %) — igual que hoy

Por línea ya descompuesta:
- `isTaxable && taxRate > 0` → `{base, tax} = decomposePrice(line, taxRate)`; `subtotal += base`; `taxAmount += tax`
- else → `subtotal += line` (exento)

Importes globales:
- `discount = computeDiscount(globalDiscountValue, globalDiscountType, rawSubtotal)` — idéntico a hoy
- `total = max(0, rawSubtotal − discount)` — **idéntico a hoy**
- `subtotal` almacenado = Σ base + Σ line exenta (nuevo valor)

Ejemplo canónico: montura 87 (16% IVA, gravable) + cristal 35 (exento):
`raw 122 → subtotal 110, tax 12, discount 12.2 (10%) → total 109.8`

## Affected consumers (post-fix)

- `sales.remote.ts` createSale + updateSale
- `quotes.remote.ts` createQuote + updateQuote + convertQuoteToSale (hoy copia `quote.subtotal`, debe recomputar)
- `EconomicBreakdownCard.svelte` — %-discount base debe ser raw = `subtotal + taxAmount` (110+12=122), no `subtotal` (110)
- customerHistory, print, SaleBalanceCards: display directo del valor almacenado — sin fórmulas, quedan consistentes
- Dashboards/cash/reports/receivables: usan `sales.total` — intactos

## Backfill migration

Recomputar `sales.subtotal` y `quotes.subtotal` desde items persistidos:
- fuentes: `unit_price`, `quantity`, `discount`, `discount_type`, `snapshot_is_taxable` (por item) + `snapshot_tax_rate` (header)
- `snapshot_is_taxable IS NULL` (free items) → exento
- UPDATE por subquery con GROUP BY sale_id; idempotente

## Tests

Unit spec para el helper puro `computeSaleTotals`:
1. Golden 87+35 → `{raw:122, subtotal:110, tax:12, total:122}`
2. 10% discount → `{discount:12.2, total:109.8, subtotal:110}`
3. FIXED discount
4. Per-line PERCENTAGE + global
5. Clamp a raw
6. Property: `total === raw − discount` siempre (equivalencia con fórmula actual)
7. Free item → exento (subtotal suma full)