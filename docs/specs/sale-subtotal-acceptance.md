# Spec: sale-subtotal-acceptance

Scope: feature

# Spec: Aceptación subtotal pre-impuesto (QA)

## Objetivo

Confirmar que el cambio de semántica de `subtotal` (de crudo con IVA a BI+Exento pre-impuesto) funciona end-to-end en UI, print, historial y que el **dinero no cambia** (`total` idéntico). Checklist ejecutado manualmente en dev por el QA antes de merge.

## Metodología

- Checklist por flujo tocado, marcar ✅/❌ en el PR.
- Item crítico fallado bloquea merge.
- Verificación final es contra una DB local con migración `0042_sale_subtotal_backfill` aplicada.

## F1 · Wizard venta (saleStep3)

- [ ] Crear venta: montura 87 gravable + cristal 35 exento + 1 item libre 150
- [ ] Card: **Subtotal 110** (75+35), IVA 12, Exento 35, Total 122 (con libre: subtotal 260, exento 185, total 262)
- [ ] Descuento global 10% de. Card: Subtotal 110 (pre-descuento), Descuento −12,2, Total 109,8
- [ ] Descuento por línea en ítem gravable: ajusta BI correctamente
- [ ] Item libre NO desaparece del subtotal (bug free corregido)
- [ ] Cambiar descuento entre % y Monto($) → valores coherentes
- [ ] Quote (presupuesto) mismo flujo (usa SaleStep3Summary) — iguales valores

## F2 · Detalle venta (EconomicBreakdownCard)

- [ ] Subtotal 110, Base imponible 75, Exento 35, IVA 12, Total 122
- [ ] Descuento % muestra −12,2 (base raw 122, no 110)
- [ ] Descuento Monto($) muestra el valor exacto
- [ ] Subtotal neto = subtotal − descuento correcto

## F3 · Print / PDF venta y quote

- [ ] Print sale: Subtotal neto 110, BI 75, Exento 35, IVA 12, Total 122 (usar getSnapshotTaxLabel)
- [ ] Print quote: mismos valores
- [ ] PDF generado (puppeteer) muestra los mismos totales

## F4 · Persistencia + historial

- [ ] Crear venta nueva → `sales.subtotal = 110` (no 122), `total = 122`
- [ ] Ventas viejas (migradas) → `subtotal` = BI+Exento, `total` intacto (difería de subtotal)
- [ ] Historial cliente ($/customers/[id]) muestra subtotal 110 consistente
- [ ] Quote→sale: subtotal/total se recomputan del quote, no copian crudo

## F5 · Cifras de dinero intactas

- [ ] Dashboard: ventas hoy = suma de `total` (sin cambios)
- [ ] Cash/pipeline/recibos/reportes: mismos montos que antes de la migración
- [ ] Comparar `total` de una venta vieja antes/después del backfill (debe ser IDÉNTICO)

## Gates técnicos

- [ ] pnpm check 0 errores
- [ ] pnpm lint limpio
- [ ] pnpm test:unit 791+ (specs nuevos)
- [ ] Migración aplicada local sin error