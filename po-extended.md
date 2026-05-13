# Plan: Extensión de Órdenes de Compra

> **Estado:** Aprobado, sin implementar.
> **Objetivo:** Agregar registro de pagos, distinción crédito/contado, y recordatorios de vencimiento a las órdenes de compra existentes.

---

## Contexto

Las órdenes de compra actuales funcionan bien para registrar recepciones de inventario, pero todo lo relacionado a pagos al proveedor se documenta hoy en el campo de descripción. Esto dificulta:

- Saber cuánto se le debe a cada proveedor.
- Registrar pagos parciales en distintas monedas/tasas.
- Detectar vencimientos próximos en compras a crédito.
- Capturar ahorros por pronto pago de forma estructurada.

### Decisiones clave tomadas

| Tema | Decisión |
|---|---|
| Monto primario del pago | Se ingresa en la moneda del pago (USDT, EUR, USD, etc.); el sistema calcula Bs y USD-BCV. |
| Anulación de pagos | Sí, vía campo `voidedAt` (no borrado físico). |
| Tasa "libre/otra" | Campo libre — cubre cualquier pago que no encaje en BCV / Binance / efectivo. |
| Cuotas de crédito | Soporta tanto vencimiento único como múltiples cuotas. |
| Descuento por pronto pago | Método contable bruto: NO modifica inventario ni `fifoUnitCost`. Se registra como ingreso financiero separado ("Descuento obtenido"). |
| Recordatorios UI | Badge en lista de POs + widget en dashboard. |

### Decisiones descartadas

- **Opción B (ajuste retroactivo de lotes):** modificar `fifoUnitCost` post-confirmación. Descartada por riesgo de inconsistencia con ventas FIFO ya consumidas.
- **Método contable neto:** asumir el descuento al recibir inventario. Descartado por complejidad operativa.

---

## Modelo de datos

### Nuevos enums (`src/lib/shared/enums/purchaseTypes.ts`)

```ts
export enum PurchasePaymentCurrencyType {
  USD_BCV = 'USD_BCV',           // USD a tasa BCV oficial
  EUR_BCV = 'EUR_BCV',           // EUR a tasa BCV
  USDT_BINANCE = 'USDT_BINANCE', // USDT Binance P2P
  USD_EFECTIVO = 'USD_EFECTIVO', // Efectivo $ (tasa paralela)
  OTHER = 'OTHER'                // Libre/otra (tasa custom o monto en Bs directo)
}

export enum PurchasePaymentTerms {
  CONTADO = 'CONTADO',
  CREDIT = 'CREDIT'
}
```

### Tabla nueva: `purchase_order_payments`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `purchaseOrderId` | uuid FK → `purchase_orders.id` ON DELETE CASCADE | |
| `paymentNumber` | integer | Secuencial dentro del PO (1, 2, 3...). |
| `currencyType` | enum | `PurchasePaymentCurrencyType`. |
| `paymentDate` | timestamptz | Fecha real del pago. |
| `amount` | double | Monto en la moneda nativa del pago. |
| `bcvUsdRate` | double | Tasa BCV USD del día del pago. **Siempre obligatoria.** |
| `specificRate` | double NULL | Tasa específica para no-BCV (USDT/Bs, EUR/Bs, paralela, libre). NULL para `USD_BCV`. |
| `amountBs` | double | Computado y almacenado. |
| `amountUsdBcv` | double | Computado y almacenado. **Normalización para saldo.** |
| `reference` | varchar NULL | Nro. de transferencia, recibo, etc. |
| `notes` | varchar NULL | Banco origen, observaciones. |
| `voidedAt` | timestamptz NULL | Marca de anulado (no rompe el secuencial). |
| `createdById` | uuid FK → `users.id` ON DELETE RESTRICT | |
| `createdAt`, `updatedAt` | timestamptz | |

**Índices:**
- `ix_po_payments_po_id` btree (purchaseOrderId)
- `ix_po_payments_payment_date` btree (paymentDate)

**Lógica de normalización (server-side, en query):**

| `currencyType` | `amountBs` | `amountUsdBcv` |
|---|---|---|
| `USD_BCV` | `amount * bcvUsdRate` | `amount` |
| `EUR_BCV` | `amount * specificRate` | `amountBs / bcvUsdRate` |
| `USDT_BINANCE` | `amount * specificRate` | `amountBs / bcvUsdRate` |
| `USD_EFECTIVO` | `amount * specificRate` | `amountBs / bcvUsdRate` |
| `OTHER` | `amount * specificRate` (o `amount` si el usuario ingresó Bs directo) | `amountBs / bcvUsdRate` |

> Nota: para `OTHER`, el formulario tendrá un toggle "Ingresar monto directo en Bs" para casos donde no aplica una tasa.

### Tabla nueva: `purchase_order_credit_schedule`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `purchaseOrderId` | uuid FK → `purchase_orders.id` ON DELETE CASCADE | |
| `installmentNumber` | integer | 1, 2, 3... |
| `dueDate` | date | Fecha de vencimiento. |
| `expectedAmountUsd` | double NULL | Monto esperado (USD BCV). NULL si no se planifica monto por cuota. |
| `earlyPaymentDiscountPercent` | double NULL | % descuento si se paga antes del deadline. |
| `earlyPaymentDiscountDeadline` | date NULL | Fecha límite para que aplique el descuento. |
| `notes` | varchar NULL | |
| `createdAt`, `updatedAt` | timestamptz | |

**Índices:**
- `ix_po_credit_schedule_po_id` btree (purchaseOrderId)
- `ix_po_credit_schedule_due_date` btree (dueDate)

> Una orden de contado simplemente no tiene filas en esta tabla. Una orden con vencimiento único tiene 1 fila. Una con cuotas múltiples tiene N filas.

### Modificación a `purchase_orders`

Añadir columna:

```ts
paymentTerms: varchar('payment_terms').notNull().default('CONTADO')
// valores: 'CONTADO' | 'CREDIT'
```

Las órdenes existentes quedan automáticamente como `CONTADO` (asumimos esto explícitamente — el histórico viejo está bien así).

---

## Lógica de negocio derivada

Estos cálculos viven en queries o en `src/lib/shared/purchaseOrderRules.ts` (puro, testeable):

### `getPurchaseOrderBalance(po, items, payments)`

```ts
{
  totalDebt: number;          // total bruto del PO (en USD BCV) — ya existe lógica
  totalPaid: number;          // suma de payments.amountUsdBcv (excluye voidedAt)
  balance: number;            // totalDebt - totalPaid
  isFullyPaid: boolean;       // balance <= 0.01
  earlyPaymentDiscountEarned: number; // ver abajo
}
```

### `getEarlyPaymentDiscountEarned(po, schedule, payments)`

- Si el saldo está a $0 (o muy cerca) y la última fecha de pago no anulado fue ≤ `earlyPaymentDiscountDeadline` de la(s) cuota(s):
  - `earned = totalDebt × earlyPaymentDiscountPercent / 100`
- Caso contrario: `0`.

Esto NO toca lotes ni `fifoUnitCost`. Es solo un valor calculado en read-time para mostrar.

### Estados de vencimiento (para badges)

| Estado | Condición |
|---|---|
| Sin vencimiento | `paymentTerms = CONTADO` o sin saldo pendiente |
| Vence hoy | Hay cuota con `dueDate = hoy` y saldo > 0 |
| Vence en X días | `dueDate` futura más próxima |
| Pronto pago disponible | `earlyPaymentDiscountDeadline ≥ hoy` y saldo > 0 |
| **VENCIDA** | `dueDate < hoy` y saldo > 0 |
| Pagada | `balance ≤ 0.01` |

---

## Integración con reportes existentes

### Reporte de caja (`/cash`)

Añadir una nueva métrica al `CashReport` que retorna [cash queries](src/lib/server/db/queries/cash.ts):

```ts
purchaseDiscountsEarned: number  // suma de earlyPaymentDiscountEarned
                                  // de todos los POs pagados en el período
```

Se muestra como item separado en el panel de resumen — **no** se suma al margen bruto. Categoría sugerida en UI: "Descuentos obtenidos en compras".

### Margen por producto / costos en ventas

**No se tocan.** Los lotes mantienen su `fifoUnitCost` bruto, los snapshots de venta mantienen su `snapshotCostUnit`. El descuento es 100% un evento financiero independiente del inventario.

---

## Plan de implementación por fases

Cada fase debe quedar mergeable y verificable de forma independiente.

### Fase 0 — Documentación y validación de datos existentes

- [ ] Verificar en producción que no hay POs en estado `CONFIRMED` con descripciones que ya estén usando texto tipo "cuota 1 de...". Si las hay, dejarlas como referencia histórica (campo `notes` no se toca).
- [ ] Confirmar que no hay nada en la DB que rompa la migración (campos nullable correctos, etc.).

### Fase 1 — Schema y migración DB

**Archivos:**
- `src/lib/shared/enums/purchaseTypes.ts` — nuevos enums.
- `src/lib/server/db/schema/purchaseOrders.ts` — `paymentTerms` en `purchase_orders`, tablas nuevas `purchaseOrderPayments` y `purchaseOrderCreditSchedule`.
- `drizzle/0017_*.sql` — migración generada.

**Verificación:** `pnpm drizzle-kit generate` + `pnpm drizzle-kit migrate` en dev.

### Fase 2 — Queries (server-side)

**Archivos nuevos:**
- `src/lib/server/db/queries/purchaseOrderPayments.ts`
  - `createPurchaseOrderPayment(data, tx)`
  - `voidPurchaseOrderPayment(id, tx)`
  - `getPaymentsForPurchaseOrder(poId, tx)`
  - `getNextPaymentNumber(poId, tx)`
- `src/lib/server/db/queries/purchaseOrderCreditSchedule.ts`
  - `replaceCreditSchedule(poId, installments, tx)` — borra y reinsertar (simplicidad).
  - `getCreditScheduleForPurchaseOrder(poId, tx)`
  - `getUpcomingDueInstallments(daysAhead, tx)` — para dashboard/badges.

**Modificaciones:**
- `src/lib/server/db/queries/purchaseOrders.ts`
  - Extender `PurchaseOrderWithRelations` para incluir `payments` y `creditSchedule` (opcional, según endpoint).
  - Función helper `computePurchaseOrderBalance(po, items, payments)`.

**Verificación:** tests unitarios para la normalización de monedas y el cálculo de balance.

### Fase 3 — Shared logic + Zod schemas

**Archivos nuevos:**
- `src/lib/shared/purchaseOrderPayments.ts` — funciones puras de normalización (Bs/USD-BCV desde currency+amount+rates). **Compartido client/server.**
- `src/lib/shared/purchaseOrderCredit.ts` — estado de vencimiento, cálculo de descuento ganado.
- `src/lib/schemas/purchaseOrderPayments.ts` — `CreatePurchasePaymentSchema`, `VoidPurchasePaymentSchema`.
- `src/lib/schemas/purchaseOrderCreditSchedule.ts` — `SetCreditScheduleSchema`.

**Tests:** `*.spec.ts` paralelo a cada archivo en `shared/`.

### Fase 4 — Remote functions

**Archivo:** `src/lib/remote/purchaseOrders.remote.ts` — extender con:

- `getPurchaseOrderPayments(query)`
- `addPurchaseOrderPaymentCmd(command)` — dentro de `db.transaction()`.
- `voidPurchaseOrderPaymentCmd(command)`
- `setPurchaseOrderCreditScheduleCmd(command)` — junto con `paymentTerms`.
- `getUpcomingDueInstallments(query)` — para dashboard.

Todas con audit logs **después** del commit (patrón ya establecido).

### Fase 5 — UI: registro y consulta de pagos

**Componentes nuevos en `src/lib/components/purchases/`:**

- `PurchaseOrderPaymentsPanel.svelte` — listado de pagos del PO + botón "Registrar pago".
- `PurchaseOrderPaymentForm.svelte` — modal/form para crear un pago. Muestra preview en vivo de Bs y USD-BCV equivalentes.
- `PurchaseOrderPaymentRow.svelte` — una fila de pago con acción "Anular".
- `PurchaseOrderBalanceCard.svelte` — total deuda / total pagado / saldo / descuento obtenido.

**Integración:** mostrar en la página de detalle del PO (cuando esté `CONFIRMED`).

### Fase 6 — UI: términos de pago y cuotas

**Componentes nuevos:**

- `PurchaseOrderCreditScheduleForm.svelte` — toggle CONTADO/CREDIT y, si CREDIT, lista editable de cuotas con fecha, monto esperado opcional, descuento por pronto pago opcional.

**Integración:**
- En `NewPurchaseOrderForm.svelte` y en la edición de drafts.
- En la vista de detalle de PO confirmado: vista de solo lectura del schedule.

### Fase 7 — UI: badges de vencimiento

- Nuevo badge: `PurchaseOrderDueBadge.svelte` (en `ui/badges/`).
- Mostrar en `PurchaseOrdersTable.svelte` junto al status badge actual.
- Filtro nuevo en la lista: "Solo con saldo pendiente" / "Solo vencidas".

### Fase 8 — Dashboard: widget de vencimientos

- Nuevo componente `UpcomingPurchasePaymentsWidget.svelte` (en `dashboard/` o donde corresponda).
- Muestra próximas N cuotas que vencen, ordenadas por fecha.
- Card destacada si hay vencidas.

**Verificación:** comprobar query performance con índice en `due_date`.

### Fase 9 — Integración con reporte de caja

- Extender `getCashReport()` en queries de caja con `purchaseDiscountsEarned`.
- Agregar fila en el panel de resumen de `/cash`.
- Asegurar que el cálculo respeta el rango de fechas del reporte (un PO se cuenta en el período en que se completó su pago).

### Fase 10 — Pulido y tests E2E

- Test Playwright cubriendo: crear PO a crédito → confirmar → registrar 2 pagos parciales → verificar saldo → registrar pago final dentro del deadline → verificar descuento obtenido en reporte.
- Revisar audit logs.
- Documentar en `AGENTS.md` o memoria de repo el patrón de pagos para futuras referencias.

---

## Consideraciones de UX

- **Form de pago:** debe ser claro cuál monto se está ingresando. Layout sugerido:
  - Selector grande de "Tipo de pago" (cards con íconos: USD BCV, EUR BCV, USDT Binance, Efectivo $, Otro).
  - Inputs dinámicos según el tipo elegido.
  - Card de preview en tiempo real: "Equivale a Bs X · USD BCV Y".
- **Resumen del PO:** después de confirmado, agregar tabs o secciones colapsables: "Items", "Pagos", "Cuotas / Vencimientos".
- **Saldo destacado:** chip grande con el saldo pendiente en USD BCV (verde si está pagado, ámbar si pendiente, rojo si vencido).

---

## Cosas explícitamente fuera de alcance

- Ajustar `fifoUnitCost` o snapshots de venta retroactivamente.
- Conciliación bancaria automática.
- Exportación a sistemas contables externos.
- Pagos parciales que afecten múltiples cuotas simultáneamente (un pago = una entrada; el saldo se reconcilia globalmente, no por cuota).
- Recordatorios por email/push notifications. Por ahora solo badges en UI.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Datos de tasas erróneos al cargar histórico | Permitir editar pagos (solo campos no calculados) o anular y recrear. |
| Confusión entre tasa BCV USD y tasa específica | Form debe mostrar ambos labels claros y un ejemplo de cálculo en vivo. |
| Performance del widget de vencimientos con muchos POs | Índice en `dueDate` + query con `LIMIT` razonable. |
| Inconsistencia entre suma de pagos y total del PO por redondeo | Toleranciada de `0.01` USD en `isFullyPaid`. |

---

## Cierre

Este plan respeta el principio que ya tiene la app: **el inventario y los costos FIFO son intocables una vez confirmados**. Todo lo que tiene que ver con el flujo de pagos vive en su propio módulo, se conecta al inventario solo por FK, y los descuentos financieros se reportan separadamente — siguiendo el método contable bruto, que es el estándar de la industria (SAP, QuickBooks, NetSuite usan este enfoque).
