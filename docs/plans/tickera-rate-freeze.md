---
plan name: tickera-rate-freeze
plan description: Congelar tasa BCV en venta
plan status: active
---

## Idea
Congelar la tasa USD BCV del momento de la venta en nueva columna sales.snapshot_bcv_rate (nullable; NULL = ventas viejas) para que la tickera en bolivares sea determinista al reimprimir días después. Escritura en createSale y convertQuoteToSale con la tasa viva del sistema al momento del submit; si la API está caída, NULL y el print cae a tasa viva (fallback documentado). printing.remote resuelve tasa efectiva sale.snapshotBcvRate ?? viva mediante helper puro resolveTicketRate testeable. Ediciones de fecha no tocan la tasa (pertenece al evento original de venta). Backfill idempotente para ventas existentes desde el bcvRate del primer pago no anulado, NULL si no hay pagos. Tickera no cambia (ya recibe bcvRate por parámetro).

## Implementation
- Schema src/lib/server/db/schema/sales.ts: agregar snapshotBcvRate doublePrecision snapshot_bcv_rate nullable + migración con backfill idempotente desde bcvRate del primer pago no anulado por venta (NULL si sin pagos)
- Helper puro + spec: resolveTicketRate(snapshotBcvRate, liveRate) en módulo compartido con casos snapshot presente, NULL con viva, ambas null; spec unitario
- sales.remote.ts createSale: persistir snapshotBcvRate con tasa viva al submit (getExchangeRateValue ya importado para pagos); NULL si API caída sin bloquear la venta
- quotes.remote.ts convertQuoteToSale: mismo snapshot al convertir
- printing.remote.ts: reemplazar getExchangeRateValue directo por resolveTicketRate(sale.snapshotBcvRate, live) manteniendo error si ambas null
- Verificación: pnpm check, pnpm lint, specs nuevos + tickera.spec + sales.spec verdes; QA manual: vender, cambiar tasa, reimprimir — ticket idéntico

## Required Specs
<!-- SPECS_START -->
- dt1-payment-strategy
- dt1-patterns
- dt1-split-protocol
- public-catalog-arch
- sale-subtotal-semantics
- tickera-rate-snap
<!-- SPECS_END -->