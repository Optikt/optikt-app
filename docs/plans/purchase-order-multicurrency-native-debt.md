# Plan: Compras Multimoneda y Deuda Nativa

Separar tres conceptos que hoy están acoplados: el costo normalizado de inventario en USD-BCV, la moneda de la factura y la obligación contractual con el proveedor. Las ventas y FIFO seguirán usando USD-BCV; cada orden conservará un saldo real en USD-BCV, Bs, EUR, USDT o PayPal y sus pagos registrarán tanto lo entregado como lo que amortiza la deuda.

## Decisiones confirmadas

- Factura/costo y moneda de obligación son campos separados; al crear una orden, la obligación inicia igual a la moneda de factura, pero puede cambiarse.
- Los pagos aceptan cualquier medio ya soportado y exigen un abono explícito en la moneda de obligación; tasas y equivalente USD-BCV son evidencia del pago, no la unidad que cierra la deuda.
- USDT y PayPal entran como monedas de factura y de obligación, además de seguir disponibles como medios de pago.
- Las órdenes existentes conservan su saldo y pagos como obligaciones legacy USD-BCV. No se reconstruirá deuda EUR/USDT desde historial ya normalizado.
- Un descuento fijo se introduce en la moneda de la factura (no en la moneda de obligación); los porcentajes se aplican sobre el monto bruto de la factura.
- La diferencia de moneda se mostrará por orden y en Caja/P&L mensual. Nunca revaluará lotes FIFO ni ventas ya realizadas.

## Modelo y fórmulas

- `sourceCurrency` representa la moneda de precios de la factura: se preservan `USD`, `VES`, `EUR` y se añaden `USDT` y `PAYPAL`; el valor técnico PayPal se mapea a `CurrencyCode.USD_PAYPAL`.
- `settlementCurrency` usa `CurrencyCode` y representa lo que el proveedor realmente exige recibir. La lista inicial es USD-BCV, VES, EUR-BCV, USDT y USD PayPal; su extensión posterior queda centralizada en constantes/mapeos, no en condicionales de pantalla.
- Las líneas siguen guardando `unitPurchasePrice` en USD-BCV como único costo FIFO. Para una moneda fuente con tasa a Bs, el costo se calcula como $\text{monto fuente} \times \text{tasa fuente Bs/unidad} \div \text{tasa BCV Bs/USD}$; VES usa tasa 1 y USD-BCV usa la tasa BCV.
- La cabecera almacenará `settlementGrossAmount`, `settlementDebtAmount` y `settlementDebtAmountUsdBcvAtOrder`. El primero es la obligación antes del descuento, el segundo es el saldo contractual neto y el tercero es su referencia BCV al emitir la orden. Para un descuento porcentual, $D=G(1-p)$; para uno fijo, $D=\max(0,G-d)$.
- Cada pago guardará `amountAppliedToDebt` y `amountAppliedToDebtUsdBcvAtOrder`, además de sus campos actuales `amount`, `amountBs` y `amountUsdBcv`. La variación realizada por pago será:

  $$V = \left(\frac{\text{amountAppliedToDebt}}{\text{settlementDebtAmount}} \times \text{settlementDebtAmountUsdBcvAtOrder}\right) - \text{amountUsdBcv}$$

  Es decir, el valor BCV original del abono (prorrateado de la obligación) menos el valor BCV real del dinero entregado. $V>0$ es ganancia financiera (se pagó menos BCV de lo previsto); $V<0$ es pérdida financiera (se pagó más BCV de lo previsto).

- Los beneficios de pronto pago también se guardarán y consumirán en la moneda de obligación, con su equivalencia USD-BCV original. Un pronto pago reduce deuda, no es un pago de caja ni una variación cambiaria.

## Fases de implementación

Cada fase es un corte autónomo con su propio checkpoint de calidad. Las fases se ejecutan en orden estricto; dentro de una fase los pasos son secuenciales, pero las fases 4A y 4B pueden ejecutarse en paralelo porque solo dependen de la fase 3.

USDT y PayPal se habilitan al usuario solo cuando la fase 4A esté completa (pagos, saldo y vencimientos funcionales de punta a punta).

---

### Fase 0. Alinear el contrato de negocio

**Objetivo:** convertir las decisiones de este plan en reglas verificables antes de modificar datos.

- Confirmar los ejemplos operativos de referencia: factura USD-BCV/deuda USDT, factura EUR/deuda EUR y pago con un medio distinto de la deuda.
- Fijar los nombres públicos de las tres cifras: costo de inventario USD-BCV, deuda contractual y valor BCV del pago.
- Definir los casos de descuento, pronto pago, sobrepago y anulación que cubrirán las pruebas.

**Checkpoint:** ejemplos aprobados y fórmulas del documento aceptadas como contrato de implementación.

---

### Fase 1. Modelo de datos y compatibilidad histórica

**Objetivo:** almacenar la obligación nativa y los snapshots necesarios sin cambiar saldos, lotes ni pagos históricos.

1. Ampliar `PurchaseSourceCurrency` en `src/lib/shared/enums/purchaseTypes.ts`; reutilizar `CurrencyCode`, etiquetas y símbolos de `src/lib/shared/enums/currencyTypes.ts` para moneda de obligación y formato uniforme.
2. En `src/lib/server/db/schema/purchaseOrders.ts`, renombrar `altRate` a `sourceRateToVes` (usando `ALTER TABLE RENAME COLUMN alt_rate TO source_rate_to_ves` para preservar datos y dependencias, sin drop+add). Añadir a `purchase_orders`: `settlementCurrency`, `settlementRateToVes`, `settlementGrossAmount`, `settlementDebtAmount` y `settlementDebtAmountUsdBcvAtOrder`. Añadir a `purchase_order_payments`: `amountAppliedToDebt` y `amountAppliedToDebtUsdBcvAtOrder`. Añadir los campos equivalentes de monto nativo y valor original a `purchase_order_early_payment_benefits`.
3. Generar `drizzle/0031_<generated>_purchase_payable_currency.sql` y actualizar el journal de Drizzle. Revisar y editar el SQL generado para que el cambio de `alt_rate` a `source_rate_to_ves` use `ALTER TABLE ... RENAME COLUMN`, nunca `DROP COLUMN` + `ADD COLUMN`. La migración establece todas las órdenes existentes como `USD_BCV`, calcula su deuda con la misma semántica actual de descuentos y rellena cada pago/beneficio histórico con su actual `amountUsdBcv` para conservar balance y no crear variación retrospectiva.
4. Mantener los campos USD-BCV de líneas, lotes y pagos para compatibilidad/auditoría; no migrar ni revaluar `inventory_lots.unitPurchasePrice`.
5. _(Opcional, puede diferirse)_ Añadir campo `defaultSettlementCurrency` a la tabla `suppliers` para que nuevas órdenes hereden automáticamente la moneda de obligación preferida del proveedor. Si el proveedor no tiene preferencia, la obligación inicia igual a la moneda de factura como ya especifica el plan.

**Checkpoint:**

- `pnpm db:generate` ejecuta sin errores.
- `pnpm db:migrate` aplica la migración en base de prueba.
- Una orden EUR histórica conserva exactamente el mismo saldo USD-BCV que antes de migrar.
- Sus pagos históricos no generan variación (valor original = valor real = cero delta).

---

### Fase 2. Motor de deuda nativa y contratos de servidor

**Objetivo:** hacer que el dominio calcule deuda, abonos y variación sin depender de la interfaz.

1. Centralizar conversiones, formato y reglas de tasa en `src/lib/shared/purchaseOrderCurrencies.ts`. Sustituir las ramas EUR/VES dispersas en `purchaseOrderPayments.ts` y `purchaseOrderDraft.ts` por esta API.
2. Reemplazar los cálculos USD-específicos de `src/lib/shared/purchaseOrderCredit.ts` por un resumen de obligación nativa: total bruto/neto, abonado, descuentos, saldo, equivalentes USD-BCV de emisión y pago, y variación acumulada. `getPurchaseOrderDueStatus` seguirá consumiendo solo el saldo numérico nativo.
3. Generalizar `src/lib/shared/purchaseOrderPayments.ts` para mantener la normalización del medio pagado a Bs/USD-BCV y añadir el cálculo determinista de la valorización BCV original del abono usando la fórmula prorrateada del modelo. Rediseñar `getEarlyPaymentDiscountSuggestion` para recomendar el abono nativo pendiente; no intentará modificar automáticamente el monto entregado en una moneda distinta.
4. Actualizar `src/lib/schemas/purchaseOrders.ts` para recibir moneda/tasa/monto de obligación y validar las tasas necesarias tanto para la moneda fuente como para la de obligación.
5. Actualizar `src/lib/schemas/purchaseOrderPayments.ts` para exigir `amountAppliedToDebt`, validarlo positivo y conservar la validación de tasa propia del medio de pago. La validación del beneficio de pronto pago se trasladará a la moneda de obligación.
6. Renombrar los nombres internos de resumen que dicen `Ves` pero representan moneda alternativa en `src/lib/components/purchases/purchaseOrderDraft.ts`, y sustituir conversiones solo-EUR por una conversión fuente genérica.

**Checkpoint:**

- `pnpm check && pnpm lint` pasa en los archivos modificados.
- `pnpm vitest run src/lib/schemas/purchaseOrders.spec.ts src/lib/shared/purchaseOrderRules.spec.ts src/lib/shared/purchaseOrderCredit.spec.ts src/lib/shared/purchaseOrderPayments.spec.ts src/lib/components/purchases/purchaseOrderDraft.spec.ts` — todos verdes, con nuevos casos para:
  - Pagos parciales, pago en moneda distinta a la deuda, pronto pago nativo, anulación.
  - Casos de ganancia cambiaria (V > 0) y pérdida cambiaria (V < 0).
  - Descuentos fijos en moneda de obligación.
  - Facturas/obligaciones USDT y PayPal.

---

### Fase 3. Persistencia, confirmación y vencimientos

**Objetivo:** que los nuevos campos se lean, escriban y filtren correctamente desde la base de datos, y que la confirmación siga creando lotes FIFO sin usar la deuda como costo.

1. Actualizar `src/lib/server/db/queries/purchaseOrders.ts`:
   - `addFinancialMetadata`: incluir campos de obligación en el SELECT y en proyecciones de listado/detalle.
   - `buildPendingBalanceCondition`: calcular el saldo nativo corriente como `settlementDebtAmount - SUM(abonos activos) - SUM(beneficios activos aplicados)`, y mover los filtros `hasPendingBalance` y `hasOverdueBalance` a operar con ese saldo nativo `> 0.01` en vez de con `amountUsdBcv`. No debe filtrar directamente sobre `settlementDebtAmount` porque ese campo es la deuda original al emitir la orden, no el saldo después de abonos parciales.
   - `confirmPurchaseOrder`: seguir creando lotes desde `unitPurchasePrice` USD-BCV y prorratear el descuento convertido con la tasa de obligación al costo de inventario.
   - Estadísticas y filtros vencidos: usar deuda nativa.
2. Actualizar `src/lib/server/db/queries/purchaseOrderPayments.ts` para leer y persistir `amountAppliedToDebt` y `amountAppliedToDebtUsdBcvAtOrder`.
   - Crear `src/lib/server/db/queries/purchaseOrderPayments.spec.ts` si no existe.
3. Actualizar `src/lib/server/db/queries/purchaseOrderCreditSchedule.ts` (`getUpcomingPurchaseOrderDues`) para devolver el código de moneda del saldo y calcular vencimientos contra la deuda nativa.
   - Crear `src/lib/server/db/queries/purchaseOrderCreditSchedule.spec.ts` si no existe.
4. Actualizar `src/lib/remote/purchaseOrders.remote.ts` para recomputar en servidor los importes de obligación al crear/guardar borradores, calcular snapshots del abono y del pronto pago dentro de la transacción de registro, y devolver el nuevo resumen nativo tras crear/anular pagos.
5. Adaptar `src/routes/(app)/purchases/[id]/+page.server.ts` y los tipos de detalle para el resumen enriquecido. Las órdenes legacy seguirán devolviendo USD-BCV con saldo idéntico al anterior.

**Checkpoint:**

- `pnpm check && pnpm lint` pasa en todos los archivos.
- `pnpm vitest run src/lib/server/db/queries/purchaseOrders.spec.ts` — verifica que una orden USDT persiste y lee sus campos de obligación, y que `hasPendingBalance` filtra correctamente por saldo nativo.
- `pnpm vitest run src/lib/server/db/queries/purchaseOrderPayments.spec.ts src/lib/server/db/queries/purchaseOrderCreditSchedule.spec.ts` — pagos persisten `amountAppliedToDebt`, vencimientos calculan contra deuda nativa.

---

### Fase 4A. UI de compras: creación, pagos y saldo

**Objetivo:** el usuario puede crear, confirmar y pagar una orden con moneda de obligación independiente, viendo saldo nativo y variación por pago.

1. En `src/lib/components/purchases/NewPurchaseOrderForm.svelte`, separar "Moneda de la factura/costo" de "Moneda que se debe al proveedor"; iniciar la segunda desde la primera, limpiar precios solo al cambiar la factura y preservar una elección manual de obligación.
2. Actualizar `src/lib/components/purchases/PurchaseOrderDocumentPanel.svelte`, `src/lib/components/purchases/PurchaseOrderItemsPanel.svelte`, `src/lib/components/purchases/PurchaseOrderItemRow.svelte` y `src/lib/components/purchases/PurchaseOrderSummaryPanel.svelte` para USDT/PayPal, tasas fuente genéricas y una lectura clara de "Costo de inventario USD-BCV" frente a "Deuda contractual".
3. Actualizar `src/lib/components/purchases/PurchaseOrderPaymentTermsPanel.svelte` para mostrar importes de crédito/pronto pago en la moneda contractual, no como USD implícito.
4. Actualizar `src/routes/(app)/purchases/[id]/+page.svelte`, `src/lib/components/purchases/PurchaseOrderBalanceCard.svelte` y `src/lib/components/purchases/PurchaseOrdersTable.svelte`: etiqueta/símbolo nativo del saldo, equivalentes BCV de referencia, monto original amortizado, pago BCV real y ganancia/pérdida por variación. La tabla de órdenes jamás sumará monedas distintas.
5. Rediseñar `src/lib/components/purchases/PurchaseOrderPaymentsPanel.svelte`: el usuario introduce medio/monto efectivamente pagado, tasas del pago y "abono a deuda" en la moneda de la orden; la vista previa muestra ambos valores BCV y la variación. Advertencias de sobrepago usan el abono nativo. Las filas de historial muestran monto entregado, abono contractual y variación individual.
6. Cambiar en `src/lib/components/purchases/PurchaseStatsCards.svelte` el rótulo ambiguo "Gasto del mes" por un concepto de costo/recepción USD-BCV.

**Checkpoint:**

- `pnpm check && pnpm lint` pasa.
- Recorrido manual en entorno de prueba: crear orden con factura USD-BCV y deuda USDT, confirmar, pagar parcialmente con Bs, verificar que el saldo sigue siendo USDT, anular pago, verificar saldo restaurado.
- Las órdenes legacy USD-BCV siguen mostrando y funcionando exactamente igual.

---

### Fase 4B. Dashboard y Caja/P&L

> **Puede ejecutarse en paralelo con la fase 4A.** Ambas solo dependen de la fase 3.

**Objetivo:** exponer la información financiera sin mezclar monedas ni revaluar inventario.

1. Adaptar `src/lib/components/dashboard/UpcomingPurchasePaymentsWidget.svelte`: eliminar la suma actual `totalPending` que agrega indiscriminadamente 250 USDT + 300 EUR como si fueran la misma unidad. Reemplazar por una agrupación por moneda de obligación donde cada grupo muestre su saldo con el símbolo y etiqueta correctos (ej. "250 USDT", "€300"). Cada fila de vencimiento individual mostrará su saldo en la moneda nativa de la orden, no forzado a `formatPrice()`.
2. En `src/lib/server/db/queries/cash.ts`, añadir `exchangeSettlementVariance` a `CashReport` y `DailyBreakdownRow`. Sumar, por fecha de pago y solo para pagos activos de órdenes confirmadas, `amountAppliedToDebtUsdBcvAtOrder - amountUsdBcv`. Incorporar el resultado al cálculo de utilidad neta junto a descuentos de compra, sin cambiar ingreso, COGS ni egresos operativos.
   - Crear `src/lib/server/db/queries/cash.spec.ts` si no existe.
3. Mostrar la variación financiera claramente diferenciada en `src/routes/(app)/cash/+page.svelte`: resumen móvil/escritorio, lectura rápida, fila diaria y exportación CSV. El signo y color deberán comunicar ganancia o pérdida, no un nuevo costo de inventario.
4. Mantener `src/lib/remote/cash.remote.ts` y `src/routes/(app)/cash/+page.server.ts` como transportes de los tipos extendidos, sin crear tablas de cierres mensuales.

**Checkpoint:**

- `pnpm check && pnpm lint` pasa.
- El dashboard agrupa vencimientos por moneda; no hay un solo número total mezclando USDT + EUR.
- En Caja/P&L, la variación aparece como línea separada con signo positivo/negativo; el CSV exporta la columna.
- `pnpm vitest run src/lib/server/db/queries/cash.spec.ts` — variación calculada correctamente.

---

### Fase 5. Integración, E2E y documentación

**Objetivo:** validar el flujo completo de punta a punta y dejar documentación para el equipo.

1. Extender `e2e/purchase-order-credit-flow.test.ts` con una PO USDT: recibir costo USD-BCV, deber 250 USDT, hacer abonos parciales nativos/con otro medio, confirmar que el saldo no se convierte a USD-BCV y verificar la variación en Caja/P&L. Actualizar su semilla para las columnas de obligación.
2. Recorrido manual final: crear una orden USD-BCV/deuda USDT → confirmar → pagar con Bs con abono explícito → verificar saldo USDT exacto → anular pago → verificar saldo restaurado → ver variación positiva/negativa en Caja/P&L → verificar agrupación en dashboard.
3. Documentar el modelo y ejemplos venezolanos en `docs/notifications-and-exchange-rates.md` o un nuevo documento focalizado en compras, incluyendo la distinción entre costo del inventario, deuda al proveedor y variación financiera.

**Checkpoint final:**

- `pnpm vitest run` — suite unitaria completa verde.
- `pnpm check && pnpm lint` — sin errores.
- `OPTIKT_RUN_PURCHASE_E2E=true pnpm test:e2e -- purchase-order-credit-flow.test.ts` — verde.
- Una orden legacy EUR se inspecciona manualmente y confirma saldo idéntico al pre-migración.
- USDT y PayPal se habilitan a todos los usuarios.

## Límites deliberados

- Incluido: USD-BCV, Bs, EUR-BCV, USDT y USD PayPal como moneda de factura/deuda; el sistema queda preparado para añadir monedas mediante una lista y mapeos centralizados.
- Excluido: proveedor automático de tasas, revaluación de inventario, reescritura de márgenes de ventas, conversión retroactiva de órdenes existentes y contabilidad formal de partidas dobles.

---

## Estado de implementación

| Fase                   | Estado | Notas                                                                   |
| ---------------------- | ------ | ----------------------------------------------------------------------- |
| 0. Contrato de negocio | ✅     | Ejemplos operativos y reglas definidas                                  |
| 1. Modelo de datos     | ✅     | Migración 0031 aplicada, campos en purchase_orders, payments y benefits |
| 2. Motor de dominio    | ✅     | purchaseOrderCurrencies, balance nativo, variación, Zod schemas         |
| 3. Persistencia        | ✅     | Queries, remote functions, +page.server.ts                              |
| 4A. UI de compras      | ✅     | Formulario, balance card, payments panel, detail page                   |
| 4B. Dashboard y Caja   | ✅     | Widget agrupa por moneda, variación en CashReport                       |
| 5. E2E y docs          | ✅     | E2E test USDT, docs/purchase-multicurrency.md                           |

### Diferido

- `defaultSettlementCurrency` en suppliers — órdenes heredan moneda preferida del proveedor
- Proveedor automático de tasas (TCita, etc.)
- Refactor de UI/UX general del módulo de compras
