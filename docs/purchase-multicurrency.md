# Compras Multimoneda

## Modelo

Una orden de compra tiene **tres conceptos separados**:

| Concepto | Campo | Ejemplo |
|----------|-------|---------|
| **Costo de inventario** (FIFO) | `purchase_order_items.unitPurchasePrice` | `$86,90` USD-BCV |
| **Moneda de la factura** | `purchase_orders.sourceCurrency` | USDT |
| **Deuda contractual** (lo que se le debe al proveedor) | `purchase_orders.settlementCurrency` | USDT |

### Por qué separarlos

En Venezuela los productos se venden a tasa BCV por ley (USD-BCV), pero los proveedores pueden cobrar en:
- USD BCV
- Bolívares (VES)
- EUR
- USDT
- USD PayPal

El costo de inventario SIEMPRE se normaliza a USD-BCV (para FIFO y márgenes de venta).  
La deuda se conserva en su moneda original.

### Campos principales

**`purchase_orders`:**
- `sourceCurrency` — moneda en que está expresada la factura
- `sourceRateToVes` — tasa Bs/unidad para convertir la moneda fuente a Bs
- `settlementCurrency` — moneda que exige el proveedor (default = source)
- `settlementRateToVes` — tasa Bs/unidad de la moneda de liquidación
- `settlementGrossAmount` — deuda bruta antes de descuento (en settlementCurrency)
- `settlementDebtAmount` — deuda neta después de descuento (en settlementCurrency)
- `settlementDebtAmountUsdBcvAtOrder` — referencia BCV de la deuda al emitir la orden

**`purchase_order_items`:**
- `unitPurchasePrice` — precio unitario en USD-BCV (costo inventario)
- `unitPurchasePriceAlt` — precio unitario en la moneda de la factura

**`purchase_order_payments`:**
- `amount` — monto ingresado en la moneda de pago
- `amountBs` — equivalente en Bs
- `amountUsdBcv` — equivalente en USD BCV
- `amountAppliedToDebt` — cuánto reduce la deuda en la moneda contractual
- `amountAppliedToDebtUsdBcvAtOrder` — referencia BCV de esa porción de deuda al emitir la orden

## Flujo de creación

1. El usuario selecciona la **moneda de la factura** (USD-BCV, Bs, EUR, USDT, PayPal)
2. Por defecto la **moneda de obligación** se iguala a la de factura
3. Se puede cambiar manualmente la moneda de obligación a una distinta
4. Los items registran el precio en la moneda fuente (`unitPurchasePriceAlt`) y su derivado en USD-BCV (`unitPurchasePrice`)
5. Al guardar, el servidor computa `settlementDebtAmount` desde los items y el descuento

## Flujo de pagos

1. El formulario detecta la moneda de liquidación de la orden
2. Por defecto selecciona Bs como moneda de pago (90% de los casos)
3. La tasa específica se pre-rellena desde la tasa registrada en la orden
4. El abono a la deuda se computa automáticamente:
   - Pago en Bs → `monto / tasaEspecífica`
   - Pago en la misma moneda → `monto`
5. La variación cambiaria se calcula y se muestra en la vista previa

## Variación cambiaria

Cuando se paga en una moneda distinta a la de liquidación (ej. pagar Bs una deuda USDT), puede haber ganancia o pérdida:

$$V = \text{valor BCV original del abono} - \text{valor BCV real pagado}$$

- `V > 0` → **ganancia** (se pagó menos BCV de lo previsto)
- `V < 0` → **pérdida** (se pagó más BCV de lo previsto)

La variación se muestra:
- Por pago individual en la pantalla de detalle
- Agregada mensualmente en Caja/P&L como "Variación cambiaria"

## Descuentos

Los descuentos se ingresan en la **moneda de la factura** (sourceCurrency). Un descuento fijo de `5` en factura USDT significa `5 USDT`. El factor de descuento se prorratea proporcionalmente a los costos USD-BCV para el inventario FIFO.

## Órdenes legacy

Todas las órdenes existentes antes de la migración se marcaron como `settlementCurrency = USD_BCV`. No tienen variación artificial porque `amountAppliedToDebt = amountUsdBcv` y `amountAppliedToDebtUsdBcvAtOrder = amountUsdBcv` en cada pago.
