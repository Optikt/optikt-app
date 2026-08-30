# Spec: dt1-patterns

Scope: repo

# DT1 · Catálogo de patrones de diseño

## Objetivo

Definir qué patrón aplicar en cada contexto de la descomposición DT1. Regla: patrón solo si reduce acoplamiento, elimina duplicación o habilita testing. Sin sobre-ingeniería.

## 1. Strategy — Métodos de pago (FLAGSHIP)

**Problema:** `PaymentForm.svelte` tiene 3+ switches sobre `PaymentMethod` (referenceConfig :333-410, nativeLabel/nativePrefix :390-415, rateType/currency derivations) y la lógica de compra duplica configuración por método (`PAYMENT_RAILS_BY_CURRENCY` vs `SALES_RAILS_BY_CURRENCY` en `paymentMethods.ts`). Agregar método de pago = cazar switches en 2+ archivos.

**Solución:**
- Interface `PaymentMethodStrategy`: `{ method, label, currency, rateType, referenceConfig, nativeLabel, nativePrefix, requiresSpecificRate, railsPerCurrency }`.
- Registry `PAYMENT_METHOD_STRATEGIES: Record<PaymentMethod, PaymentMethodStrategy>` en `src/lib/shared/payments/strategies.ts`.
- Consumidores: PaymentForm (UI), validación server (addSalePayment/addPurchaseOrderPayment), resumen de conversión.
- Resultado: método nuevo = 1 entrada registry + tests de esa entrada. Zero switches dispersos.

## 2. Adapter — 3 casos concretos

- **(a) DB executor:** `DbOrTx` (`src/lib/server/db/types.ts`) ya es seam de inyección (`executor: DbOrTx = db`). Formalizar interface `QueryExecutor` para que tests inyecten double en memoria. Habilitante de DT9.
- **(b) Pagos entre dominios:** `PaymentSubmissionInput` (monto, método, moneda, referencia, rate) + adapters `SalePaymentAdapter` / `PurchasePaymentAdapter` → mapean a `addSalePayment`+`recalcSalePaidAmount` vs `addPurchaseOrderPayment`+recalculo crédito/saldos. UI deja de saber a qué dominio paga.
- **(c) Transporte remote:** `query()`/`command()` de `$lib/remote` ya adaptan transporte SvelteKit — mantener wrapper, no reimplementar.

## 3. Factory — funciones puras, no clases

**Casos existentes:** `createEmptyLensDraft()` (EditSaleModal:170), `createEmptyPurchaseOrderDraftItem()` (purchaseOrderDraft:124), `createPurchaseOrderDraftItemFromExisting()` (:147).

- Consolidar por dominio: `sales/itemFactory.ts` (`createEmptyProductItem`, `createEmptyFreeItem`, `createEmptyLensDraft`, `existingItemToInput`).
- Svelte idiom: función factory pura + `$state` en el componente consumidor. No clases factory.
- Beneficio: test directo sin instanciar componentes.

## 4. Builder — solo payloads multi-paso opcionales

**Casos reales:** `buildQuoteItemsFromWizard`, `buildStep2PrescriptionConfirmation` (saleItemHelpers:658), `buildTaxItemsFromWizard` (:781), `calculatePurchaseOrderSummary` (purchaseOrderDraft:538).

- Extraer a módulos puros `builders/wizardPayload.ts` con funciones compuestas (named partials + compose final). No clases Builder formales — overkill.
- Filtros de queries (`PurchaseOrderFilterOptions`) candidatos si 3+ queries comparten opciones — evaluar por caso, no forzar.

## 5. Singleton — RECHAZADO

**Motivo:** estado mutable global oculto = tests frágiles + riesgo SSR leakage.

**Sustitutos:**
- Registries inmutables a nivel módulo (ej. `PAYMENT_METHOD_STRATEGIES`) → single source sin estado.
- Svelte context para instancias por árbol (`setContext` raíz, `getContext` hijos).
- Servicios módulo existentes (exchangeRates cache) quedan como están — auditar solo si DT1 los toca.

## 6. Observer — NO

`$state`/`$derived` cubren reacción intra-componente; context + callbacks cubren inter-componente. No introducir event bus.

## 7. Context vs Props — política anti prop drilling

**Regla de 2 niveles:** prop que atraviesa 2+ niveles intermedios sin transformarse → context.

- **Context para:** datos compartidos de solo lectura (precedente `CATALOG_KEY`), coordinación de página (precedente `purchaseOrderDetail.ts`), comandos de página (`ctx.toggleReviewed(id)`).
- **Props para:** acciones de componente hoja, datos que el padre transforma, componentes reusables fuera del árbol (deben quedar context-free).
- **Interface:** `src/lib/context/<dominio>.ts` con Symbol key + setter/getter tipados con throw si falta (patrón `inventoryCount.ts`). Getter devuelve funciones reactivas para datos `$state` del padre.
- **Anti-patrón a evitar:** context para estado de escritura disperso (oculta flujo de datos, dificulta tests). Estado de escritura vive en el orquestador (page/root); context solo expone sus comandos.

## 8. Verificación de patrones

Cada patrón introducido requiere: spec test unitario del módulo puro, `pnpm check`/`pnpm lint`/`pnpm test` verde, cero cambio de comportamiento visible.