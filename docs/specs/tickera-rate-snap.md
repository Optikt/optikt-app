# Spec: tickera-rate-snap

Scope: feature

# Tickera Rate Freeze — tasa BCV congelada por venta

## Contrato

- `sales.snapshot_bcv_rate` (nullable) congela la tasa USD BCV viva al momento del submit de la venta.
- La tickera en Bs siempre calcula con la tasa efectiva `sale.snapshotBcvRate ?? tasa viva`. Reimprimir una venta días después produce el mismo ticket.
- `NULL` = ventas anteriores a esta feature → fallback a tasa viva (documentado, sin backfill inventado más allá de pagos).

## Escritura

- `createSale` y `convertQuoteToSale` persisten la tasa viva del submit.
- Si la API de tasas está caída al vender, se guarda `NULL` sin bloquear la venta; el print usará la viva.
- Editar la venta (incluida la fecha) jamás toca la tasa: pertenece al evento original.

## Backfill histórico

- Idempotente: `snapshot_bcv_rate := bcvRate del primer pago no anulado` por venta; `NULL` si no hay pagos.
- Aproximación honesta: tasa del día de pago, no del día de venta. Mejor que la viva actual.

## Resolución en print

- Helper puro `resolveTicketRate(snapshot, live)`: snapshot si > 0, si no live, si no error (mismo error actual cuando no hay tasa).
- `tickera.ts` no cambia: ya recibe `bcvRate` por parámetro.

## Límites

- Solo USD BCV (única tasa que usa la tickera). Sin tabla normalizada de tasas por día (YAGNI).
- Recibo PDF en dólares intacto (no usa tasa).

## Aceptación

- Vender con tasa X, cambiar la viva a Y, reimprimir → ticket idéntico con X.
- Venta vieja sin snapshot reimprime con viva (fallback visible, sin crash).
- `pnpm check`, `pnpm lint`, specs nuevos + `tickera.spec` verdes.
