# receivables (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Lista de cuentas por cobrar (saldo de clientes) + registro de pago. Fuente de verdad del saldo = `total − paidAmountBcvUsd`.

## Scope

`remote/receivables.remote.ts`, `queries/receivables.ts`, `routes/(app)/receivables/**`, `schemas/receivables*`.

Owner rules: el pago reutiliza tal cual `addPayment` del dominio `sales` (validaciones, tx pago+recálculo, audit); la semántica de estados de venta es del doc `sales`.

## Reglas de dominio / invarianzas

- ⚠️ **Definición de cuenta por cobrar** (`queries/receivables.ts:59-63`, spec `docs/specs/completed/receivables-multi-status.md`): `deletedAt IS NULL` ∧ `status != 'CANCELLED'` ∧ `balance > 0`. El estado **no** determina la deuda: solo CANCELLED excluye — incluye PENDING/IN_PROGRESS/READY/COMPLETED, porque un `voidPayment` puede dejar una venta COMPLETED bajo pagada.
- No duplicar el filtro inline: viven dashboard (`pendingPayments`) y `/receivables` reutilizándolo (spec `:29-36`).
- Pago desde `/receivables` reutiliza `addSalePayment` tal cual (`receivables.remote.ts:59`): **no cambia el estado manualmente**; el toast "Venta completada" es solo informativo (`+page.svelte:132-136`).
- Orden por saldo DESC; los pagos se agrupan por venta en una sola query (`receivables.ts:88,97-110`).

## Patrones locales

- Loader delgado que delega directo a `getReceivables` (`+page.server.ts:9`).
- Filtros/sort/antigüedad (≤7 / 8–30 / >30 días) resueltos en cliente con estado en URL (`+page.svelte:59-107`).
- Modal de pago reutiliza `PaymentForm` con `kind="sale"` y `remainingBcvUsd = row.balance`.

## Testing

- Hueco: `getReceivables` sin tests — la primera regla no trivial que toque este dominio debería venir con spec (la definición de elegibilidad vive en `docs/specs/completed/receivables-multi-status.md:29-36`).

## Known gaps / tech debt

- 🟡 Filtro `customerId` con schema definido pero sin consumer en la página (`+page.server.ts:9`).
- 🟡 Sin paginación: carga todas las ventas con saldo + su historial de pagos (`receivables.ts:56-88`).
- 🟠 `setSaleStatus` sin guard de saldo (fuera del alcance del spec, mejora futura — coordinar con doc `sales`).
