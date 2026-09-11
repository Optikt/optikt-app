# Spec: sale-date-truth

Scope: feature

# Sale Date Truth — created_at como única fecha de venta

## Contrato

- `sales.created_at` es la única fecha-verdad de la venta: fecha negocio editable + hora real.
- Columna `sales.sale_date` no existe. Ningún código la referencia.
- Schemas/forms hablan `saleDate` (lenguaje dominio "fecha de venta"); solo la capa remote mapea alias → columna `createdAt`. Ningún otro layer conoce el mapeo.

## Regla de hora (Venezuela)

- Form envía solo día (`YYYY-MM-DD`, editable, no negociable).
- Hora = instante del submit, compuesta en `America/Caracas` (offset `-04:00` explícito, nunca TZ del servidor).
- Persistencia en UTC ISO. Lecturas formatean en `America/Caracas`.
- Caso borde: submit 23:30 VET conserva día VET elegido aunque en UTC sea día siguiente.

## Backfill histórico

- `created_at := fecha(sale_date) + hora(created_at)` por fila.
- Ventas normales: día negocio + hora real conservada.
- Backfills viejos (sale_date pasado, created_at de carga): día correcto + hora de carga. Hora fabricada aceptada y documentada.

## Auditoría

- `createdAt` fuera de `excludeFields` en `logUpdate` de venta: ediciones de fecha se auditan.
- Instante de carga original se recupera del evento create en `change_history`, no de columnas.
- `SaleAuditTimeline` ancla creación al evento create, nunca a `sale.createdAt`.

## Límites

- Solo ventas. No tocar `quotes.quoteDate`, `purchase_orders.orderDate`, `sale_payments.paymentDate`, `purchase_order_payments.paymentDate`, `prescriptions.prescriptionDate`, `cash_expenses.expenseDate` (deuda técnica aparte).
- `updatedAt` sigue siendo última modificación, sin semántica de carga.

## Aceptación

- Crear venta con día editado guarda `created_at` con ese día + hora submit; ticket imprime hora real (no `00:00`).
- Editar fecha conserva hora existente (lógica actual `EditSaleModal`).
- Listados, dashboard, reportes, receivables, historial cliente filtran/ordenan por `createdAt`.
- `pnpm check`, `pnpm lint`, suites `sales.spec`, `tickera.spec`, `quotes.spec` verdes.