# cash (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Egresos operativos de efectivo (`cash_expenses`) + reporte P&L "on-the-fly" de caja (ingresos, COGS, egresos, descuentos de compra, variación cambiaria), desgloso diario y pipeline de ventas PENDING. No hay cierre diario persistido — todo es agregación calculada. Independiente de purchase orders/inventario (`schema/cashExpenses.ts:18-27`).

## Scope

`components/cash/**`, `routes/(app)/cash/**`, `remote/cash.remote.ts`, `queries/cash/**` (daily, expenses, pipeline, report), `schemas/cash*`, `schema/cashExpenses.ts`, lógica pura `shared/expenseCalculations*` + enums `shared/enums/cashTypes.ts`.

## Reglas de dominio / invarianzas

**Permisos**

- Todos los endpoints y páginas: `requireAdmin()` / `requirePageRole(ADMIN, MANAGER)` — ADMIN **o** MANAGER, no solo ADMIN (`remote/cash.remote.ts:87-128`, `routes/(app)/cash/+page.server.ts:10`). Cualquiera de esos roles puede crear y anular egresos; **no hay flujo de aprobación**.

**Moneda — snapshot inmutable**

- `amount` se guarda en moneda nativa y `amountUsd` es snapshot USD-BCV al registrar; cambios de tasa posteriores **no recalculan** (`schema/cashExpenses.ts:22-27`).
- Conversión (`shared/expenseCalculations.ts:42-67`, propiedad de este dominio): USD directo; VES `amount / bcvRate`; USDT `amount * exchangeRate / bcvRate`; EUR `amount * exchangeRate`. Redondeo 2 decimales.
- **El servidor recomputa `amountUsd`** — nunca confía en el cliente (`remote/cash.remote.ts:45-78`); exige `exchangeRate > 0` para VES/USDT/EUR (400 si falta).
- `rateType` (`BCV|PARALLEL|DIRECT`): requerido para VES y EUR; USDT fuerza `'DIRECT'` en server aunque el cliente no lo mande (`cash.remote.ts:148-152`); USD → null.

**Egresos — soft-delete**

- Nunca se borran: `voidedAt/voidedById/voidReason`. Anulación idempotente: `WHERE voided_at IS NULL`; si ya anulado → null → 409 (`queries/cash/expenses.ts:51-64`, `cash.remote.ts:176-180`). Motivo ≥ 5 chars (`schemas/cash.ts:72-75`).
- Anulados excluidos de todos los totales; visibles con `includeVoided`.
- 13 categorías fijas (`shared/enums/cashTypes.ts:11-25`) — union type, no pgEnum.

**Reconocimiento de ingresos y caja (P&L, `queries/cash/report.ts`)**

- Venta cuenta como ingreso solo con `status='COMPLETED'` (pagada + entregada), anclada en `completedAt`. El flujo de caja (cobrado) es independiente, por `sale_payments.payment_date` (`report.ts:12-14,134-144`).
- ⚠️ Pagos de ventas `CANCELLED` **sí** cuentan en caja (el dinero llegó físicamente); el reembolso se registra como egreso REFUND que lo compensa — invariant de auditoría (`report.ts:199-203`). No "arreglar" quitando esos pagos.
- Anticipos retenidos al cancelar (`refundStatus='RETAINED'`) son otros ingresos por `cancelledAt`, sin COGS (`report.ts:52-54,180-197`).
- Descuentos por pago anticipado a proveedores: ingreso financiero solo si `appliedToBalance=true`, no voided, orden CONFIRMED (`report.ts:91-100`).
- Variación cambiaria = `amountAppliedToDebtUsdBcvAtOrder − amountUsdBcv` de pagos a compras confirmadas (`report.ts:106-132`).
- COGS por coste snapshot del ítem (viene del FIFO del dominio `inventory`); items con `snapshotCostTotal` NULL se excluyen y marcan `cogsIncomplete=true` (`report.ts:142-143,239-255`).
- **Fórmula del P&L**: `netProfit = grossProfit − expenses + purchaseDiscounts + exchangeVariance`.

**Fechas/validaciones** (`schemas/cash.ts`): descripción 3–500, monto > 0, `bcvRate > 0` siempre como referencia, tasa condicional por moneda, `to >= from` en filtros.

## Patrones locales

- Split DT1 (fase 4): `queries/cash/{expenses,daily,report,pipeline}.ts`; UI con páginas orquestadoras + componentes (`CashToolbar/Summary/Pipeline/DailyTable`, `ExpenseToolbar/Summary/Table/CreateModal`).
- Todas las query fns aceptan `executor: DbOrTx = db` (regla global, acá aplicada sistemáticamente, `expenses.ts:16-17`).
- Agregaciones en paralelo (`Promise.all`) + merge por fecha en JS con buckets; agrupación de fechas con `date_trunc('day', …)` + `to_char` en Postgres (`daily.ts:54`).
- CSV builders puros y testeables: `buildExpenseCsvRows`, `buildCashCsvRows` (`expenseForm.ts:41`, `cashReport.ts:21`).

## Testing

- Unit: `db/queries/cash.spec.ts` (variación cambiaria), `schemas/cash.spec.ts` (validación por moneda, motivos, fechas), `components/cash/expenseForm.spec.ts` (CSV/void), `cashReport.spec.ts`.
- QA checklists: `docs/specs/cash-expenses-qa.md`, `docs/specs/cash-dash-qa.md` (CSV 11 columnas, monedas con/sin tasa, pipeline).
- Hueco: sin tests de pipeline ni del reporte P&L completo.

## Known gaps / tech debt

- 🟡 `netProfit` duplicado en JS (`report.ts:323` vs `daily.ts:204-210`) — extraer a helper compartido del dominio antes de tocar la fórmula.
- 🟡 Filtros de status con SQL crudo (`sql\`${sales.status} = 'PENDING'\``) en vez de comparación tipada (≥ 5 lugares, `pipeline.ts:57`).
- 🟡 Docblock panorámico repetido en los 4 archivos de `queries/cash/` tras el split — quedó decrito para funciones que mudaron.
- 🟡 `computeAmountUsd` (`cash.remote.ts:50-78`): triple validación redundante de tasa (ya vive en el Zod schema); consolidar.
- 🟡 `pipeline.ts:48-91`: 3 queries separadas donde un `count(*) FILTER` bastaría.
- 🟠 Enums `@deprecated` vivos (`EXPENSE_CURRENCY_LABELS/SYMBOLS/isUsdLike`, `cashTypes.ts:70-88`) — migrar a `getCurrencyLabel`.
- 🟠 Categoría REFUND con doble significado (compensa pagos de ventas canceladas) — invariant documentado solo en comentario de `report.ts:199-203`; cualquier cambio en el P&L debe considerla.
