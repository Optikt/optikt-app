# Spec: dt9-remote-core

Scope: feature

# DT9 · Shell/Core para remote functions

Patrón para que la lógica de negocio sea testeable sin depender de los internals de SvelteKit, y para que el esfuerzo de testing vaya a testing real y no a pelear con la infra de remotes.

## Contexto

- Un `.remote.ts` usa `$app/server` + `getRequestEvent()`; llamarlo en vitest sin contexto lanza `Could not get the request store`.
- SvelteKit NO tiene test utils oficiales (issue #14796 abierto; PR #15671 sin mergear y rechazado por un maintainer: "el wrapper es framework code, la lógica debe vivir en una función plana").
- DT1 ya extrajo gran parte de la lógica a `src/lib/server/db/queries/**` (patrón `executor: DbOrTx`). DT9 completa la orquestación.

## Invariantes

- **Shell** (`src/lib/remote/**/*.remote.ts`):
  - `command(Schema, async (data) => { ... })` / `query` / `form`.
  - `requireRole(...)` / `requireAdmin()` (guards).
  - `getAuditContext()`.
  - Delega en el core y devuelve su resultado. Sin reglas de negocio, sin `db.transaction`.
- **Core** (`src/lib/server/<dominio>/<accion>.ts`):
  - `export async function <accion>Core(input: <Input>, ctx: ActionContext): Promise<Result>`.
  - Reglas de negocio dependientes de estado de DB (venta cancelada, owner, tasas requeridas, saldos).
  - `db.transaction(async (tx) => ...)` y `tx` en cada query.
  - Audit **después** de la transacción (best-effort), nunca dentro.
  - Prohibido: `getRequestEvent`, guards, `requireRole`, imports de `$app/server`.
- `ActionContext = { userId: string; role: UserRole; ipAddress: string; userAgent: string | null }`.
  - Rol presente para checks de owner que dependen del actor; identidad para audit.

## Convención de nombres / ubicación

- Core: `src/lib/server/<dominio>/<accion>.ts` → `<accion>Core`.
  - Ej.: `src/lib/server/sales/addSalePayment.ts` → `addSalePaymentCore`.
- Adapters de pago (capa baja, reciben `executor: DbOrTx`): `src/lib/server/payments/`.
  - `salePayments.ts` (existe).
  - `purchasePayments.ts` (extraer de `addPurchaseOrderPaymentCmd`).
- Tests de integración: `*.int.spec.ts` colocado junto al core.

## Commands a migrar (14 críticos)

1. `createSale` (sales/commands)
2. `addPayment` / `voidPayment` (sales/payments)
3. `setSaleStatus` (sales/status)
4. `cancelSale` (sales/lifecycle)
5. `updateSale` (sales/update)
6. `createNewQuote` / `updateExistingQuote` (quotes/commands)
7. `convertQuoteToSale` (quotes/lifecycle)
8. `confirmPurchaseOrderCmd` (purchaseOrders/review)
9. `addPurchaseOrderPaymentCmd` (purchaseOrders/payments)
10. `voidPurchaseOrderPaymentCmd` (purchaseOrders/payments)
11. `cancelPurchaseOrderCmd` (purchaseOrders/review)
12. `createManualAdjustmentCmd` (inventory)
13. `revertFullLotCmd` (inventory)
14. `inventoryCount.applySession` (inventoryCount)

## Migración incremental

- No big-bang: cada PR extrae el core de los commands que va a testear, verbatim (sin cambios de comportamiento/UX).
- Mantener el shape de retorno actual para no romper consumidores.
- Si un command es puramente lectura/trivial, no se fuerza core.

## Criterios de aceptación

- Cero reglas de negocio con DB dentro de los `.remote.ts` migrados.
- Cores testeados contra DB real (Capa 2) cubriendo happy path + reglas + rollback.
- 1-2 tests de wrapper por command crítico (guard, validación con hook real, rollback, audit).
- `addPurchaseOrderPaymentCmd` reducido a shell; `purchasePayments.ts` testeado con `DbOrTx` (desbloquea lo diferido en `dt1-payment-strategy`).

## Estado (2026-09-19) — todos migrados

Los 14 commands críticos tienen core en `src/lib/server/**` y test contra Postgres real (`*.int.spec.ts`), con el `.remote.ts` como shell (guards + schema + audit + delegate):

| #     | Core                                                       | Test                                                               |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| 1     | `sales/createSale.ts`                                      | `createSale.int.spec.ts`                                           |
| 2     | `sales/addSalePayment.ts` / `voidSalePayment.ts`           | `addSalePayment.int.spec.ts` / `voidSalePayment.int.spec.ts`       |
| 3     | `sales/setSaleStatus.ts`                                   | `setSaleStatus.int.spec.ts`                                        |
| 4     | `sales/cancelSale.ts`                                      | `cancelSale.int.spec.ts` + `cancelSaleFifo.int.spec.ts`            |
| 5     | `sales/updateSale.ts`                                      | `updateSale.int.spec.ts` + `updateSaleFifo.int.spec.ts`            |
| 6     | `quotes/createNewQuote.ts` / `updateExistingQuote.ts`      | tests de ramas en `src/lib/server/quotes/`                         |
| 7     | `quotes/convertQuoteToSale.ts`                             | guardas + happy path                                               |
| 8-11  | `purchaseOrders/**` (confirm/cancel/pagos)                 | `purchaseOrders/**/*.int.spec.ts` + `payments/purchasePayments.ts` |
| 12-13 | `inventory/createManualAdjustment.ts` / `revertFullLot.ts` | `inventory/*.int.spec.ts`                                          |
| 14    | `inventoryCount.applySession`                              | `db/queries/inventoryCount/sessions.int.spec.ts`                   |

Extra: `sales/updateItemCosts.ts` y `sales/enrichFreeItem.ts` (items.remote) + `sales/saleItemInsert.ts` / `shared/saleItemValues.ts` / `server/treatmentValidation.ts` compartidos por ventas y presupuestos.
