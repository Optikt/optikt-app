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
- Ventas: `consumeFifoForSaleItem` (`queries/fifoConsumption.ts:56-201`), compartido por `createSale` y `convertQuoteToSale` vía `queries/sales/saleItemInsert.ts:59`. PRODUCT → FIFO completo (descuento de lotes + movimiento `SALE_OUT` + caché `products.stock`); producto sin lotes o lente modo STOCK → solo decrementa contador (error si quedaría < 0, validación **antes** del FIFO, `:80-84`); TREATMENT → coste desde `supplier_treatments.price` o `snapshotBaseCost` override (`:178-198`). Cancalación/edición devuelven con `returnToLot` + movimiento `CANCEL_REVERT` espejo del `SALE_OUT` (`server/sales/cancelSale.ts:65`, `server/sales/updateSale.ts:197`).
- Lentes STOCK: los ajustes manuales sí usan lotes FIFO (`getActiveLensLotsFifo`); sin entrada previa, se fabrica una PO técnica confirmada + lote (ver deuda).

**Autorización de ajustes**

- `createManualAdjustment` y `revertFullLot`: `requireRole(ADMIN)` (`remote/inventory.remote.ts:61-70`). Solo lotes de PRODUCT (`createManualAdjustment.ts:25-27`); flujo en tx: lote → movimiento → caché de stock.
- `revertFullLot` (`server/inventory/revertFullLot.ts`) deshace la creación completa de un lote de PO: exige `quantityAvailable === quantityInitial` (`:25-30`, ni una unidad consumida) y registra `ADJUSTMENT_OUT` con referencia `PURCHASE_ORDER`.
- Conteos: las diferencias **no** se aplican automáticamente — se corrigen dentro de la sesión (`applyCountLineAdjustment` / `applyAdjustmentsBatch` en `queries/inventoryCount/adjustments.ts`, ambos en `db.transaction`) reutilizando `applyManualAdjustment` y **vinculando el `inventory_movement` a la línea** (`adjustmentMovementId`); «Ajustado» = existe el movimiento. El flujo viejo (`countAdjustments` + `setLineAdjustmentStatus`, marcador sin movimiento) fue retirado.

**Conteos** (`queries/inventoryCount/**`, `schema/inventoryCount.ts`)

- Sesión `OPEN|APPLIED|CANCELLED`; una sola abierta garantizada por índice único parcial en `status='OPEN'` + doble check en `createSession` (`sessions.ts`, en `db.transaction`). Snapshot: todos los ítems elegibles con stock > 0 o con movimientos históricos; error si 0 elegibles.
- **Alcance = ids, no etiquetas** (spec 12.3): `scope_values` guarda ids de marca/proveedor o valores de `ProductType`. `buildCoverageGroups` agrupa por `groupValueOf` (id crudo; ítems sin clave — lentes en BRAND/TYPE — no forman grupo) y `filterScopeItems` filtra por el mismo id. El preview de alcance (`previewScope`) no calcula `movementsSince` (no lo muestra).
- Captura: ADMIN/MANAGER/SELLER con participación activa (`requireWriteAccess`); aplicar/cancelar: **solo ADMIN o MANAGER**, con re-check dentro de `applySession` (doble verificación de autorización).
- **Cierre**: cierra con stock 0 sin confirmar, **bloquea recuentos obligatorios** (`recountedStock` ≠ null) sobre umbral; fija `lastCountedAt` solo en líneas verificadas; guarda cobertura antes→después (`coverage_before` con `coverageSummaryLite`, sin agrupados). Aplicar **no genera** movimientos de ajuste.
- Recuento conserva el conteo primario y lo superpone; **cambiar un conteo limpia recuento, ajuste y vínculo** (`lines.ts:upsertCountLine`).
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

- 🟡 `consumeFifoForSaleItem` no consume lotes de lentes-STOCK (solo el contador), mientras que los ajustes de lente sí tocan lotes FIFO → posible divergencia lotes vs contador para LENS.
- 🟡 `applyManualAdjustment` (`inventoryLots.ts:261`) duplica el flujo de `createManualAdjustment` (misma secuencia lote+movement+stock) con autorización distinta; unificar.
- 🟡 `RETURN_IN` declarado "futuro" (credit notes pendiente) — no confundir con `CANCEL_REVERT`, que sí está en uso.
- 🟡 `adjustLensStock` fabrica una PO falsa confirmada (coste 0, bcv 0) como soporte de entrada de lente — hack que ensucia la tabla de purchase orders (`remote/lenses/catalog-stock.remote.ts:96-137`).
- 🟡 `revertFullLot` no restringe a lotes de PRODUCT (una PO de lente pasaría la validación).
- 🟡 Acoplamiento de bordes: `fifoConsumption` de inventory vive en `queries/` (raíz) y `purchases/lifecycle` escribe lotes/movimientos — mantener el borde documentado al refinar cualquier lado.
