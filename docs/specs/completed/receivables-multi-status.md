# Spec: receivables-multi-status

Scope: feature

# Cuentas por Cobrar — Multi-Estado

## Definición de "cuenta por cobrar" (deuda de cliente)

Una venta es una cuenta por cobrar **si y solo si**:

- `deletedAt IS NULL`
- `status != 'CANCELLED'`
- `total - paidAmountBcvUsd > 0`

El saldo es la fuente de verdad. El estado de la venta **no** determina si hay deuda — solo `CANCELLED` la excluye.

## Estados incluidos

| Estado      | Incluido | Razón                                                                                                   |
| ----------- | -------- | ------------------------------------------------------------------------------------------------------- |
| PENDING     | ✅       | Flujo normal de deuda                                                                                   |
| IN_PROGRESS | ✅       | Deuda real pendiente                                                                                    |
| READY       | ✅       | Deuda real pendiente                                                                                    |
| COMPLETED   | ✅       | Posible vía `setSaleStatus` manual (sin guard de saldo); `voidPayment` revierte solo si queda bajo pago |
| CANCELLED   | ❌       | Deuda no cobrable                                                                                       |

## Reglas

- Toda agregación de deuda de ventas (`total - paidAmountBcvUsd`) usa `status != 'CANCELLED'` (o `inArray` de los 4 estados activos) + filtro `balance > 0`.
- No duplicar el filtro inline: si se extrae, usar helper compartido.
- `CANCELLED` nunca genera deuda, incluso si tuviera pagos previos.

## Superficies afectadas (hoy)

- Dashboard `pendingPayments` — card "Balance Pendiente Total" (`dashboard.ts`)
- `/receivables` — lista, summary, totales (`receivables.ts`, `receivables/+page.svelte`)

## UI

- La lista /receivables muestra el estado de cada venta con badge (colores/labels de `shared/enums/salesTypes.ts`).
- Labels de cards describen "ventas con saldo", no "ventas pendientes".
- Al pagar una venta desde /receivables el estado NO cambia automáticamente (transiciones manuales; el toast "Venta completada" es informativo).

## Fuera de alcance

- Cambiar lógica de transición de estados (`setSaleStatus` guard de saldo) — posible mejora futura, no requerida aquí.
- Auto-completar ventas al saldar deuda.
