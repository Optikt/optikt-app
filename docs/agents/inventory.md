# inventory (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Inventario físico trazable de la óptica: lotes reales creados por orden de compra (con coste/peso tasado), log **inmutable** de movimientos, consumo FIFO para costes, ajustes manuales (solo ADMIN) y conteos físicos por sesión. No existe borrado: toda corrección crea movimientos inversos.

## Scope

`components/inventory/**`, `routes/(app)/inventory/**`, `remote/inventory*.remote.ts`, `server/inventory/**`, `queries/inventoryLots|inventoryMovements.ts`, `queries/inventoryCount/**`, `queries/fifoConsumption.ts`, `schemas/inventory*`, `schema/inventoryCount|inventoryLots|inventoryMovements.ts`, `shared/enums/inventoryTypes.ts`, lógica pura FIFO en `utils/inventory.ts` + `utils/fifoScenarios.spec.ts`.

Owner rules: la creación de lotes/movimientos por PO vive en el flujo de `purchases` (border purchases↔inventory); el consumo por venta vive en `sales` vía `saleItemInsert` → `consumeFifoForSaleItem` (este dominio).

## Reglas de dominio / invarianzas

**Lotes** (`schema/inventoryLots.ts`)

- 1 lote por ítem de PO (`purchaseOrderItemId` NOT NULL, FK restrict). `lotNumber` secuencial único (`inventoryLots.ts:26,55`); `getNextLotNumber` exige estar en tx (`queries/inventoryLots.ts:61`).
- Snapshots al crear: `unitPurchasePrice` (= precio PO × factor descuento de liquidación, redondeado), `unitSalePrice`, `bcvRateAtPurchase` (`queries/purchaseOrders/lifecycle.ts:58-83`). `products.currentPurchasePrice` se recalcula con `getNextFifoCost`; `currentSalePrice` **no se toca** sin aprobación (`lifecycle.ts:107-116`).
- `isActive=false` cuando `quantityAvailable=0`; `returnToLot` reactiva (`inventoryLots.ts:202-252`).

**Movimientos** (`schema/inventoryMovements.ts:37-43`)

- Tabla **inmutable**: sin `updatedAt` ni `deletedAt`; corrección = insert de movimiento inverso.
- Tipos: `PURCHASE_IN | SALE_OUT | ADJUSTMENT_IN | ADJUSTMENT_OUT | CANCEL_REVERT` + `RETURN_IN` (declarado, aún no usado — futuro/credit notes, `shared/enums/inventoryTypes.ts:78-87`). ⚠️ No consolidar tipos ni borrar registros.
- `quantityDelta` (+ entra / − sale) con `quantityBefore/After` por lote; unitCost de ajuste solo en `ADJUSTMENT_OUT` sin `CUSTOMER_RETURN` (`inventoryTypes.ts:109-122`).
- `CUSTOMER_RETURN` siempre fuerza `ADJUSTMENT_IN` (transform en `schemas/inventory.ts:25-31,44-49`); motivo ≥ 10 chars, cantidad ≥ 1.

**FIFO**

- Plan puro sin DB: `planFifoConsumption` (`utils/inventory.ts:38-81`) — lote más viejo primero; lanza si los lotes no cubren la cantidad.
- Ventas: `consumeFifoForSaleItem` (`queries/fifoConsumption.ts:56-201`), compartido por `createSale` y `convertQuoteToSale` vía `queries/sales/saleItemInsert.ts:59`. PRODUCT → FIFO completo (descuento de lotes + movimiento `SALE_OUT` + caché `products.stock`); producto sin lotes o lente modo STOCK → solo decrementa contador (error si quedaría < 0, validación **antes** del FIFO, `:80-84`); TREATMENT → coste desde `supplier_treatments.price` o `snapshotBaseCost` override (`:178-198`). Cancalación/edición devuelven con `revertSaleInventory` (`server/sales/revertSaleInventory.ts`): neto por lote de `SALE_OUT` + `CANCEL_REVERT` → revertir solo el saldo pendiente (nunca re-revertir lo ya revertido — el log es inmutable) + movimiento `CANCEL_REVERT` espejo (`server/sales/cancelSale.ts`, `server/sales/updateSale.ts`).
- Lentes STOCK: los ajustes manuales sí usan lotes FIFO (`getActiveLensLotsFifo`); sin entrada previa, se fabrica una PO técnica confirmada + lote (ver deuda).

**Autorización de ajustes**

- `createManualAdjustment` y `revertFullLot`: `requireRole(ADMIN)` (`remote/inventory.remote.ts:61-70`). Solo lotes de PRODUCT (`createManualAdjustment.ts:25-27`); flujo en tx: lote → movimiento → caché de stock.
- `revertFullLot` (`server/inventory/revertFullLot.ts`) deshace la creación completa de un lote de PO: exige `quantityAvailable === quantityInitial` (`:25-30`, ni una unidad consumida) y registra `ADJUSTMENT_OUT` con referencia `PURCHASE_ORDER`.
- Conteos: las diferencias **no** se aplican automáticamente — en Revisar solo se **solicitan** (`requestCountLineAdjustment` / `requestAdjustmentsBatch` / `clearLineAdjustmentRequest` en `queries/inventoryCount/adjustments.ts`: guardan motivo+solicitante en la línea, `adjustment_requested_by/at`, **sin movimiento**) y los `inventory_movement` se crean **al cerrar** (`executeCountLineAdjustment` dentro de la `db.transaction` de `applySession`; si uno falla, todo revierte y la sesión sigue OPEN). **Cancelar descarta las solicitudes**: nunca queda stock movido por un conteo no aplicado. Cambiar un conteo limpia la solicitud (mismo invariante que recuento/ajuste). «Ajustado» = existe el movimiento vinculado (siempre post-cierre). El flujo viejo (`countAdjustments` + `setLineAdjustmentStatus`, marcador sin movimiento) fue retirado.
  El PR lleva **una sola migración** (`0048_opposite_rick_jones`): los viejos 0048+0049+0050 fueron squasheados en un archivo regenerado desde el snapshot 0047, con sus backfills preservados + los nuevos de `fifo_cost_usd` al final. Rollback total si se descarta el PR: `DROP TABLE "inventory_count_responsibles";` + dropear los ALTER de `inventory_count_lines` (`recounted_*`, `adjustment_*`, `fifo_cost_usd`), `settings` (`count_*`), `products`/`lens_catalog_items` (`last_counted_*`) y `inventory_count_sessions` (`scope_*`, `coverage_*`); los backfills solo se revierten si se descartan sus datos (`last_counted_at`→NULL, responsables añadidos en aperturas → borrar).

**Conteos** (`queries/inventoryCount/**`, `schema/inventoryCount.ts`)

- Sesión `OPEN|APPLIED|CANCELLED`; una sola abierta garantizada por índice único parcial en `status='OPEN'` + doble check en `createSession` (`sessions.ts`, en `db.transaction`). Snapshot: todos los ítems elegibles con stock > 0 o con movimientos históricos; error si 0 elegibles.
- **Alcance = ids, no etiquetas** (spec 12.3): `scope_values` guarda ids de marca/proveedor o valores de `ProductType`. `buildCoverageGroups` agrupa por `groupValueOf` (id crudo; ítems sin clave — lentes en BRAND/TYPE — no forman grupo) y `filterScopeItems` filtra por el mismo id. El preview de alcance (`previewScope`) no calcula `movementsSince` (no lo muestra).
- Captura: ADMIN/MANAGER/SELLER con participación activa (`requireWriteAccess`); aplicar/cancelar: **solo ADMIN o MANAGER**, con re-check dentro de `applySession` (doble verificación de autorización).
- **Cierre**: cierra con stock 0 sin confirmar, **bloquea recuentos obligatorios** (`recountedStock` ≠ null) sobre umbral; fija `lastCountedAt` solo en líneas verificadas; guarda cobertura antes→después (`coverage_before` con `coverageSummaryLite`, sin agrupados). Aplicar **no genera** movimientos de ajuste.
- Recuento conserva el conteo primario y lo superpone; **cambiar un conteo limpia recuento, ajuste y vínculo** (`lines.ts:upsertCountLine`).
- **Informe estable (spec 409)**: el costo FIFO de cada línea con diferencia se congela en `inventory_count_lines.fifo_cost_usd` al **cerrar** (`applySession`, _antes_ de ejecutar los ajustes — un ajuste a 0 drena el lote) y al **cancelar** (`cancelSession`). `buildLineCostMap` prefiere la columna (sin queries extra) y solo cae al FIFO vivo si es null (sesión OPEN o ítem sin lote al congelar). La misma migración **backfillea las sesiones ya cerradas** (congela el FIFO vigente al merge). Límite conocido: una línea congelada en null que después reciba stock sí cambiaría — ver Known gaps.
- Responsables: `inventory_count_responsibles` con baja lógica (quitar no borra lo contado); el creador queda activo.
- UI: el cierre es **solo con el CTA de fase** (el stepper navega ①↔② y nunca cierra, mockup `if(p==3)break`); fase 3 = «Volver a cobertura».

## Patrones locales

- Remote delgado: auth + delegación a `*Core` en server (`remote/inventory.remote.ts:1-5`). Errores de negocio como `{ success:false, error }` (no throw) en cores; en conteos se lanza y la remota captura.
- Escrituras multi-paso siempre dentro de un solo `db.transaction` con `tx` pasado a cada query fn (regla global).
- Import circular intencional `sessions ↔ lines` (lazy import con comentario, `sessions.ts:16`).
- Contadores de search con relevancia junto a filtros combinados (`inventoryMovements.ts:339`).
- Guardado de líneas de conteo por **cola «último valor gana»** (`shared/countLineSaveQueue.ts`): un envío por línea a la vez, líneas distintas en paralelo y sin bloqueo global de la hoja; el input de la línea en vuelo queda `readonly` (`savingLineIds`, `$state(Set)`).

## Known gaps / tech debt — latencia de DB

- 🟡 **DB remota (Supabase) = ~76 ms por roundtrip** (medido 2026-11-09): los flujos multi-query del conteo se sienten lentos — `upsertCountLine` ≈4 roundtrips (≈800 ms end-to-end con el protocolo remote), `createSession` ≈3 s, auth añade 1 roundtrip fijo por request (`hooks.server`). **Con la DB en contenedor (docker/Dokploy) el roundtrip es ~1-2 ms y esto no aplica.** Si algún día se retoma una DB remota: la primera palanca es reducir roundtrips por flujo (selects explícitos, UPDATE…RETURNING, resúmenes ligeros), no cambiar de proveedor.

## Testing

- Integración (Testcontainers, `pnpm test:integration`): `createManualAdjustment.int.spec.ts`, `revertFullLot.int.spec.ts`, `inventory.int.spec.ts` (harness `callRemote`, 401 sin auth), `remote/inventoryCount.int.spec.ts` (Capa 3: creación por dimensión/atajos, preview por id, roles, recuento, ajustes vinculados, cierre), `inventoryCount/sessions.int.spec.ts` (lifecycle + regla de cierre).
- Puros: `utils/inventory.spec.ts` + `fifoScenarios.spec.ts` (invarianzas FIFO multi-escenario — el espejo de referencia), `schemas/inventory.spec.ts`, `inventoryCount.spec.ts`.
- Lógica pura de la UI de conteo: `shared/inventoryCount.spec.ts` (semáforo/umbrales/cierre), `shared/countSessionPhase.spec.ts` (CTA y stepper por fase), `shared/countLineSaveQueue.spec.ts` (cola «último valor gana»).

## Known gaps / tech debt

- 🟡 `fifo_cost_usd` null congelado (ítem sin lote al cerrar/cancelar) cae al FIFO vivo como mejor esfuerzo: si después recibe stock, el informe de esa línea cambiaría. Distinguir «congelado sin costo» de «nunca congelado» requeriría una columna `cost_frozen_at` (money-reviewer M1).

- 🟡 `adjustment_requested_by` (migración `0048_opposite_rick_jones`) no tiene FK a `users` (asimetría con `adjustment_completed_by_id`); si se quiere integridad, va en una migración nueva (0049), nunca editando 0048.

- 🟡 `consumeFifoForSaleItem` no consume lotes de lentes-STOCK (solo el contador), mientras que los ajustes de lente sí tocan lotes FIFO → posible divergencia lotes vs contador para LENS.
- 🟡 `applyManualAdjustment` (`inventoryLots.ts:261`) duplica el flujo de `createManualAdjustment` (misma secuencia lote+movement+stock) con autorización distinta; unificar.
- 🟡 `RETURN_IN` declarado "futuro" (credit notes pendiente) — no confundir con `CANCEL_REVERT`, que sí está en uso.
- 🟡 `adjustLensStock` fabrica una PO falsa confirmada (coste 0, bcv 0) como soporte de entrada de lente — hack que ensucia la tabla de purchase orders (`remote/lenses/catalog-stock.remote.ts:96-137`).
- 🟡 `revertFullLot` no restringe a lotes de PRODUCT (una PO de lente pasaría la validación).
- 🟡 Acoplamiento de bordes: `fifoConsumption` de inventory vive en `queries/` (raíz) y `purchases/lifecycle` escribe lotes/movimientos — mantener el borde documentado al refinar cualquier lado.
