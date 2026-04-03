# PLAN_DB — Sistema Transaccional de Inventario por Lotes (FIFO)

> **Estado:** EN PLANIFICACIÓN
> **Fecha inicio:** Abril 2026
> **Método de valoración:** FIFO (First In, First Out)
> **Principio fundamental:** Nunca borrar historial — contrarresta con movimientos

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Estado Actual del Schema](#2-estado-actual-del-schema)
3. [Arquitectura Objetivo](#3-arquitectura-objetivo)
4. [Tablas Nuevas (4)](#4-tablas-nuevas)
5. [Modificaciones a Tablas Existentes (3)](#5-modificaciones-a-tablas-existentes)
6. [Enums Nuevos](#6-enums-nuevos)
7. [Flujos de Negocio Detallados](#7-flujos-de-negocio-detallados)
8. [Reglas de Negocio y Validaciones](#8-reglas-de-negocio-y-validaciones)
9. [Casos Edge y Corrección de Errores](#9-casos-edge-y-corrección-de-errores)
10. [Plan de Migración](#10-plan-de-migración)
11. [Checklist de Implementación](#11-checklist-de-implementación)

---

## 1. Resumen Ejecutivo

### Problema

El schema actual no tiene soporte transaccional de inventario. `products.stock` es un campo estático que se modifica manualmente. No hay registro de entradas (compras), salidas (ventas), ni ajustes. Es imposible auditar, conciliar o calcular márgenes reales por transacción.

### Solución

Implementar un sistema de **inventario por lotes con FIFO**:

- **Productos** = solo identidad y características (sin precios como fuente de verdad)
- **Compras (Cargas)** = cabecera de factura + líneas → al confirmar, genera **Lotes**
- **Lotes** = unidad real de inventario (producto + cantidad + precios + origen)
- **Ventas** = consumen lotes en orden FIFO, registran precio real usado
- **Movimientos** = log inmutable de toda entrada/salida/ajuste
- **Stock** = `SUM(quantity_available)` de lotes activos (campo cached en products)

### Alcance

| Acción | Cantidad | Detalle |
|--------|----------|---------|
| Tablas nuevas | 4 | `purchase_orders`, `purchase_order_items`, `inventory_lots`, `inventory_movements` |
| Tablas modificadas | 3 | `products`, `sale_items`, `lens_catalog_items` |
| Enums nuevos | 3 | `PurchaseOrderStatus`, `InventoryMovementType`, `MovementReferenceType` |
| Tablas sin cambios | 18 | Todo lo demás se mantiene intacto |
| **Estrategia** | **Fresh** | **DROP todas las tablas y CREATE desde cero — sin migración de datos legacy** |

---

## 2. Estado Actual del Schema

### Lo que está BIEN (no tocar)

| Componente | Por qué está correcto |
|------------|----------------------|
| Separación `products` vs `lens_catalog_items` | Son entidades con comportamientos radicalmente distintos (stock físico vs catálogo por demanda) |
| Snapshots en `sale_items` / `quote_items` | Captura de precios al momento de transacción — estándar absoluto |
| Sistema multi-moneda con BCV USD | Correcto para Venezuela |
| `change_history` genérica | Buen patrón de auditoría |
| Lógica polimórfica de items (PRODUCT \| LENS_PAIR \| TREATMENT) | Correcta para el dominio |
| Patrón `DbOrTx` para transacciones | Permite atomicidad configurable |

### Lo que hay que cambiar

| Tabla | Problema | Solución |
|-------|----------|----------|
| `products` | `stock` nullable, precios estáticos como fuente de verdad | `stock` → NOT NULL DEFAULT 0 (cached counter). Los precios viven en lotes. Agregar `currentPurchasePrice` / `currentSalePrice` como referencia rápida |
| `products` | Campos `purchasePrice`, `purchaseCurrency`, `purchaseCurrencyRate`, `purchaseUsdBcvRate`, `purchaseDate`, `normalizedCostUsd`, `salePrice` son la fuente de verdad | **ELIMINAR** todos estos campos. Los precios viven exclusivamente en lotes. Solo se agregan `currentPurchasePrice` / `currentSalePrice` como cached refs del último lote |
| `sale_items` | No hay trazabilidad al lote consumido | Agregar `lotId` FK → `inventory_lots` |
| `sale_items` | No hay snapshot del costo de compra | Agregar `snapshotPurchasePrice` para margen real |
| `lens_catalog_items` | `stock` nullable para modo STOCK | Mantener nullable (solo relevante en modo STOCK, no en ON_DEMAND/LAB) |

---

## 3. Arquitectura Objetivo

### Diagrama de Dominio

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOMINIO: COMPRAS (NUEVO)                        │
│                                                                         │
│  purchase_orders ──< purchase_order_items ──> inventory_lots            │
│  (cabecera)          (líneas)                  (stock real)             │
│                                                     │                   │
│                                                     ▼                   │
│                                          inventory_movements            │
│                                          (log inmutable)                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                  ┌───────────┼───────────┐
                  ▼           ▼           ▼
            ┌──────────┐ ┌────────┐ ┌──────────────────┐
            │ products │ │ sales  │ │ lens_catalog_items│
            │ (cached  │ │ (FIFO  │ │ (STOCK mode only)│
            │  stock)  │ │  out)  │ │                  │
            └──────────┘ └────────┘ └──────────────────┘
```

### Flujo General

```
CARGA (Compra)                    DESCARGA (Venta/Ajuste)
═══════════════                   ═════════════════════
purchase_order (DRAFT)            sale → sale_items
       │                                   │
       ▼ confirmar                         ▼ FIFO
purchase_order (CONFIRMED)        inventory_lots.quantity_available -= N
       │                                   │
       ▼                                   ▼
inventory_lots (creados)          inventory_movements (SALE_OUT)
       │                                   │
       ▼                                   ▼
inventory_movements (PURCHASE_IN) products.stock -= N (cached)
       │
       ▼
products.stock += N (cached)
```

---

## 4. Tablas Nuevas

### 4.1 `purchase_orders` — Cabecera de Compra (Carga)

```
purchase_orders
├── id: uuid PK
├── orderNumber: integer NOT NULL UNIQUE          -- auto: secuencial "PO-0001"
├── supplierId: uuid FK → suppliers.id NOT NULL   -- proveedor
├── invoiceNumber: varchar                        -- # de factura (nullable)
├── deliveryNoteNumber: varchar                   -- # nota de entrega (nullable)
├── status: enum NOT NULL DEFAULT 'DRAFT'         -- DRAFT | CONFIRMED | CANCELLED
├── orderDate: timestamp NOT NULL                 -- fecha de la compra
├── bcvRate: doublePrecision NOT NULL             -- tasa BCV del día
├── notes: varchar
├── createdById: uuid FK → users.id NOT NULL      -- quién creó
├── confirmedById: uuid FK → users.id             -- quién confirmó (nullable)
├── confirmedAt: timestamp                        -- cuándo se confirmó (nullable)
├── deletedAt: timestamp                          -- soft delete
├── createdAt: timestamp NOT NULL DEFAULT NOW
└── updatedAt: timestamp NOT NULL DEFAULT NOW
```

**Índices:**
- `ix_purchase_orders_id` (btree, uuid)
- `ix_purchase_orders_order_number` (btree, unique)
- `ix_purchase_orders_supplier_id` (btree, uuid)
- `ix_purchase_orders_order_date` (btree, timestamp)
- `ix_purchase_orders_status` (btree, text)

**FKs:**
- `supplierId` → `suppliers.id` ON DELETE RESTRICT
- `createdById` → `users.id` ON DELETE RESTRICT
- `confirmedById` → `users.id` ON DELETE SET NULL

**Reglas de estado:**
```
DRAFT ──(confirmar)──> CONFIRMED
  │                        │
  └──(cancelar)──> CANCELLED    (solo si DRAFT, sin lotes)
                        
CONFIRMED: no se puede cancelar directamente.
           Para "deshacer", usar ajustes manuales.
```

---

### 4.2 `purchase_order_items` — Líneas de Compra

```
purchase_order_items
├── id: uuid PK
├── purchaseOrderId: uuid FK → purchase_orders.id NOT NULL
├── itemType: varchar NOT NULL                    -- 'PRODUCT' | 'LENS' (reusa concepto)
├── productId: uuid FK → products.id              -- nullable (solo si itemType = PRODUCT)
├── lensCatalogItemId: uuid FK → lens_catalog_items.id  -- nullable (solo si itemType = LENS)
├── quantity: integer NOT NULL                    -- cantidad comprada
├── unitPurchasePrice: doublePrecision NOT NULL   -- precio de compra unitario (USD BCV)
├── unitSalePrice: doublePrecision NOT NULL       -- precio de venta propuesto (USD BCV)
├── appliesIva: boolean NOT NULL DEFAULT true     -- ¿aplica IVA?
├── ivaRate: doublePrecision NOT NULL DEFAULT 16  -- tasa IVA (%)
├── lotId: uuid FK → inventory_lots.id            -- se llena al confirmar (nullable)
├── createdAt: timestamp NOT NULL DEFAULT NOW
└── updatedAt: timestamp NOT NULL DEFAULT NOW
```

**Índices:**
- `ix_purchase_order_items_id` (btree, uuid)
- `ix_purchase_order_items_po_id` (btree, uuid)
- `ix_purchase_order_items_product_id` (btree, uuid)
- `ix_purchase_order_items_lens_id` (btree, uuid)

**FKs:**
- `purchaseOrderId` → `purchase_orders.id` ON DELETE CASCADE
- `productId` → `products.id` ON DELETE RESTRICT
- `lensCatalogItemId` → `lens_catalog_items.id` ON DELETE RESTRICT
- `lotId` → `inventory_lots.id` ON DELETE SET NULL

**Notas:**
- `itemType` es `PRODUCT` o `LENS`. No es un pgEnum — usamos varchar para flexibilidad (alineado con el patrón existente en `sale_items.item_type` que usa pgEnum pero los valores son los mismos conceptos).
- Para lentes con `inventory_mode = ON_DEMAND` o `LAB`, **no se crean líneas de compra** — su costo se registra directamente en `sale_items` al vender.
- Solo lentes con `inventory_mode = STOCK` participan en el sistema de compras/lotes.

---

### 4.3 `inventory_lots` — Lotes de Inventario

```
inventory_lots
├── id: uuid PK
├── lotNumber: integer NOT NULL UNIQUE            -- auto-secuencial
├── purchaseOrderItemId: uuid FK → purchase_order_items.id NOT NULL  -- origen
├── itemType: varchar NOT NULL                    -- 'PRODUCT' | 'LENS'
├── productId: uuid FK → products.id              -- nullable
├── lensCatalogItemId: uuid FK → lens_catalog_items.id  -- nullable
├── quantityInitial: integer NOT NULL             -- cantidad que entró
├── quantityAvailable: integer NOT NULL           -- cantidad restante (decrementada)
├── unitPurchasePrice: doublePrecision NOT NULL   -- snapshot del precio de compra
├── unitSalePrice: doublePrecision NOT NULL       -- precio de venta de este lote
├── bcvRateAtPurchase: doublePrecision NOT NULL   -- tasa BCV al momento de compra
├── isActive: boolean NOT NULL DEFAULT true       -- false cuando quantityAvailable = 0
├── createdAt: timestamp NOT NULL DEFAULT NOW
└── updatedAt: timestamp NOT NULL DEFAULT NOW
```

**Índices:**
- `ix_inventory_lots_id` (btree, uuid)
- `ix_inventory_lots_lot_number` (btree, unique)
- `ix_inventory_lots_product_id` (btree, uuid)
- `ix_inventory_lots_lens_id` (btree, uuid)
- `ix_inventory_lots_po_item_id` (btree, uuid)
- `ix_inventory_lots_active_product` (btree, productId + isActive) — para FIFO queries
- `ix_inventory_lots_active_lens` (btree, lensCatalogItemId + isActive) — para FIFO queries

**FKs:**
- `purchaseOrderItemId` → `purchase_order_items.id` ON DELETE RESTRICT
- `productId` → `products.id` ON DELETE RESTRICT
- `lensCatalogItemId` → `lens_catalog_items.id` ON DELETE RESTRICT

**Invariantes:**
- `quantityAvailable >= 0` siempre
- `quantityAvailable <= quantityInitial` siempre
- Cuando `quantityAvailable = 0` → `isActive = false`
- `productId XOR lensCatalogItemId` — exactamente uno debe tener valor
- La **fuente de verdad** del stock es: `SUM(quantityAvailable) WHERE productId = X AND isActive = true`
- `products.stock` es un **cached counter** que DEBE estar sincronizado

---

### 4.4 `inventory_movements` — Log Inmutable de Movimientos

```
inventory_movements
├── id: uuid PK
├── movementType: enum NOT NULL                   -- tipo de movimiento
├── lotId: uuid FK → inventory_lots.id NOT NULL   -- lote afectado
├── itemType: varchar NOT NULL                    -- 'PRODUCT' | 'LENS' (denormalized)
├── productId: uuid FK → products.id              -- nullable (denormalized para queries)
├── lensCatalogItemId: uuid FK → lens_catalog_items.id  -- nullable (denormalized)
├── quantityDelta: integer NOT NULL               -- positivo = entrada, negativo = salida
├── quantityBefore: integer NOT NULL              -- stock del lote ANTES del movimiento
├── quantityAfter: integer NOT NULL               -- stock del lote DESPUÉS del movimiento
├── referenceType: varchar NOT NULL               -- tipo de documento origen
├── referenceId: uuid NOT NULL                    -- id del documento origen
├── notes: varchar                                -- motivo (especialmente en ajustes)
├── createdById: uuid FK → users.id NOT NULL      -- quién realizó el movimiento
├── createdAt: timestamp NOT NULL DEFAULT NOW      -- NUNCA se edita
```

**ESTA TABLA ES INMUTABLE.** No tiene `updatedAt`, no tiene `deletedAt`. Los registros nunca se modifican ni eliminan. Si hay un error, se crea un movimiento nuevo de corrección.

**Índices:**
- `ix_inventory_movements_id` (btree, uuid)
- `ix_inventory_movements_lot_id` (btree, uuid)
- `ix_inventory_movements_product_id` (btree, uuid)
- `ix_inventory_movements_lens_id` (btree, uuid)
- `ix_inventory_movements_type` (btree, text)
- `ix_inventory_movements_reference` (btree, referenceType + referenceId) — para buscar movimientos de un documento
- `ix_inventory_movements_created_at` (btree, timestamp) — para reportes cronológicos

**FKs:**
- `lotId` → `inventory_lots.id` ON DELETE RESTRICT (nunca borrar lotes con movimientos)
- `productId` → `products.id` ON DELETE RESTRICT
- `lensCatalogItemId` → `lens_catalog_items.id` ON DELETE RESTRICT
- `createdById` → `users.id` ON DELETE RESTRICT

---

## 5. Modificaciones a Tablas Existentes

### 5.1 `products` — Cambios

**Campos que CAMBIAN:**

**Campos que se ELIMINAN:**

| Campo eliminado | Motivo |
|----------------|--------|
| `purchasePrice` | Los precios de compra viven exclusivamente en lotes |
| `salePrice` | Los precios de venta viven exclusivamente en lotes |
| `purchaseCurrency` | La moneda/tasa se registra por compra, no por producto |
| `purchaseCurrencyRate` | Idem — vive en `purchase_orders` |
| `purchaseUsdBcvRate` | Idem — vive en `purchase_orders` |
| `purchaseDate` | El producto no tiene "fecha de compra" — cada lote tiene la suya |
| `normalizedCostUsd` | Se calcula desde el lote cuando se necesita |

**Campos que CAMBIAN:**

| Campo actual | Cambio | Motivo |
|-------------|--------|--------|
| `stock: integer()` (nullable) | → `integer().notNull().default(0)` | Cached counter, siempre tiene valor |

**Campos que se AGREGAN:**

| Campo nuevo | Tipo | Descripción |
|-------------|------|-------------|
| `currentPurchasePrice` | `doublePrecision` (nullable) | Precio de compra del lote más reciente. Se actualiza al confirmar compra. |
| `currentSalePrice` | `doublePrecision` (nullable) | Precio de venta del lote más reciente. Se actualiza al confirmar compra. |

**Campos que se MANTIENEN sin cambiar:**
- `minStock` — se mantiene nullable (configuración opcional de alerta)
- Todos los demás campos de identidad (sku, name, type, brand, supplier, material, etc.)

> Los queries de listado (`getAllProducts`) usan `currentPurchasePrice` / `currentSalePrice` como cached values del último lote. Las cotizaciones (`quote_items`) también usan estos campos como referencia rápida. Es el mismo patrón que `stock` como cached counter.

### 5.2 `sale_items` — Cambios

**Campos que se AGREGAN:**

| Campo nuevo | Tipo | Descripción |
|-------------|------|-------------|
| `lotId` | `uuid FK → inventory_lots.id` (nullable) | Lote FIFO consumido. NULL para items de tipo LENS_PAIR (ON_DEMAND/LAB) y TREATMENT |
| `snapshotPurchasePrice` | `doublePrecision` (nullable) | Costo de compra del lote consumido, para calcular margen real |

**FK nueva:**
- `lotId` → `inventory_lots.id` ON DELETE RESTRICT

**Índice nuevo:**
- `ix_sale_items_lot_id` (btree, uuid)

**Nota sobre LENS_PAIR / TREATMENT items:**
- Items tipo `LENS_PAIR` con modo `ON_DEMAND` o `LAB`: `lotId = NULL`, `snapshotPurchasePrice` se llena manualmente al registrar el costo del pedido
- Items tipo `TREATMENT`: `lotId = NULL`, no aplica lote
- Items tipo `PRODUCT`: `lotId` DEBE tener valor (FIFO obligatorio)
- Items tipo `LENS_PAIR` con modo `STOCK`: `lotId` DEBE tener valor (FIFO obligatorio)

### 5.3 `lens_catalog_items` — Cambios Mínimos

**Sin cambios estructurales.** El campo `stock` se mantiene nullable porque:
- `ON_DEMAND` / `LAB`: `stock = NULL` (no se trackea)
- `STOCK`: `stock = integer` (cached counter, mismo patrón que products)

Para lentes en modo `STOCK`, los lotes y movimientos funcionan igual que para products. La diferencia es que la FK en el lote apunta a `lensCatalogItemId` en vez de `productId`.

---

## 6. Enums Nuevos

### 6.1 `PurchaseOrderStatus`

```typescript
// src/lib/shared/enums/purchaseTypes.ts

export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}
```

**Transiciones válidas:**
- `DRAFT` → `CONFIRMED` (genera lotes + movimientos)
- `DRAFT` → `CANCELLED` (solo si no tiene lotes)
- `CONFIRMED` → ❌ (no se puede revertir — usar ajustes manuales)
- `CANCELLED` → ❌ (estado terminal)

### 6.2 `InventoryMovementType`

```typescript
export enum InventoryMovementType {
  /** Entrada por compra confirmada */
  PURCHASE_IN = 'PURCHASE_IN',
  /** Salida por venta */
  SALE_OUT = 'SALE_OUT',
  /** Entrada por ajuste manual (corrección positiva, donación recibida) */
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  /** Salida por ajuste manual (merma, error, robo, regalo) */
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  /** Entrada por devolución de cliente (futuro) */
  RETURN_IN = 'RETURN_IN',
  /** Reversión por cancelación de compra:
   *  cuando se elimina un item de PO cuyo lote no tiene ventas */
  CANCEL_REVERT = 'CANCEL_REVERT'
}
```

### 6.3 `MovementReferenceType`

```typescript
export enum MovementReferenceType {
  /** Referencia a una purchase_order */
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  /** Referencia a una sale */
  SALE = 'SALE',
  /** Ajuste manual sin documento padre */
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT'
}
```

### 6.4 `PurchaseOrderItemType`

```typescript
export enum PurchaseOrderItemType {
  PRODUCT = 'PRODUCT',
  LENS = 'LENS'
}
```

---

## 7. Flujos de Negocio Detallados

### 7.1 Crear Compra (Carga)

```
POST /api/purchase-orders

1. Crear purchase_order con status = DRAFT
2. Agregar purchase_order_items (N líneas)
   - Cada línea tiene: itemType, productId/lensCatalogItemId, quantity, precios
3. Validaciones:
   - Product/lens debe existir y estar activo
   - Proveedor coincide con el de la cabecera
   - Quantity > 0
   - Precios > 0
4. Estado: DRAFT (editable)
```

### 7.2 Confirmar Compra (Carga → Lotes)

```
POST /api/purchase-orders/:id/confirm

DENTRO DE UNA TRANSACCIÓN (db.transaction):

1. Validar que el PO está en DRAFT
2. Para CADA purchase_order_item:
   a. Crear inventory_lot:
      - lotNumber = getNextLotNumber(tx)
      - quantityInitial = quantity
      - quantityAvailable = quantity
      - unitPurchasePrice = item.unitPurchasePrice
      - unitSalePrice = item.unitSalePrice
      - bcvRateAtPurchase = po.bcvRate
      - isActive = true
   
   b. Actualizar purchase_order_item.lotId = nuevo lot.id
   
   c. Crear inventory_movement:
      - movementType = PURCHASE_IN
      - lotId = nuevo lot.id
      - quantityDelta = +quantity
      - quantityBefore = 0
      - quantityAfter = quantity
      - referenceType = PURCHASE_ORDER
      - referenceId = po.id
   
   d. Actualizar cached counter:
      - Si PRODUCT: products.stock += quantity
      - Si LENS (STOCK): lens_catalog_items.stock += quantity
   
   e. Actualizar referencia rápida en producto:
      - products.currentPurchasePrice = item.unitPurchasePrice
      - products.currentSalePrice = item.unitSalePrice

3. Actualizar purchase_order:
   - status = CONFIRMED
   - confirmedById = usuario
   - confirmedAt = now()

4. Log en change_history (post-tx, best effort)
```

### 7.3 Venta de Producto (FIFO Out)

```
POST /api/sales (createSale)

DENTRO DE UNA TRANSACCIÓN (db.transaction):

Para cada sale_item de tipo PRODUCT:

1. Buscar lotes FIFO:
   SELECT * FROM inventory_lots
   WHERE product_id = X
     AND is_active = true
     AND quantity_available > 0
   ORDER BY created_at ASC  -- FIFO: más antiguo primero

2. Consumir del lote más antiguo:
   - Si lote.quantityAvailable >= item.quantity:
     → Consumir todo de este lote
     → lotId = lote.id
   
   - Si lote.quantityAvailable < item.quantity:
     → ERROR: "Stock insuficiente. Disponible: X, solicitado: Y"
     → (No split de items entre lotes — un sale_item = un lote)
     → ALTERNATIVA FUTURA: permitir split (más complejo)

3. Actualizar inventory_lot:
   - quantityAvailable -= item.quantity
   - Si quantityAvailable = 0 → isActive = false

4. Crear inventory_movement:
   - movementType = SALE_OUT
   - quantityDelta = -item.quantity
   - quantityBefore = lote.quantityAvailable (antes)
   - quantityAfter = lote.quantityAvailable (después)
   - referenceType = SALE
   - referenceId = sale.id

5. Guardar en sale_item:
   - lotId = lote.id
   - snapshotPurchasePrice = lote.unitPurchasePrice
   - unitPrice = lote.unitSalePrice (o precio ajustado por el vendedor)
   - snapshotSalePrice = lote.unitSalePrice

6. Actualizar cached counter:
   - products.stock -= item.quantity
```

### 7.4 Venta de Lente (según modo)

```
LENS_PAIR con inventory_mode = STOCK:
→ Mismo flujo FIFO que PRODUCT (sección 7.3)
→ lotId poblado, snapshotPurchasePrice del lote

LENS_PAIR con inventory_mode = ON_DEMAND:
→ NO consume lote (lotId = NULL)
→ snapshotPurchasePrice = NULL o se llena después cuando llega la factura del proveedor
→ snapshotSalePrice = lens_catalog_items.salePrice
→ snapshotBaseCost = lens_catalog_items.basePrice
→ No hay movimiento de inventario

LENS_PAIR con inventory_mode = LAB:
→ Igual que ON_DEMAND (no hay stock, es fabricación a medida)
```

### 7.5 Ajuste Manual (Descarga/Carga de Corrección)

```
POST /api/inventory/adjustments

Para errores, merma, robo, correcciones:

1. Seleccionar lote específico
2. Indicar tipo: ADJUSTMENT_IN (+) o ADJUSTMENT_OUT (-)
3. Indicar cantidad y motivo (OBLIGATORIO)

DENTRO DE UNA TRANSACCIÓN:

a. Validar:
   - Si ADJUSTMENT_OUT: lote.quantityAvailable >= cantidad
   - Motivo no vacío

b. Actualizar inventory_lot:
   - quantityAvailable += quantityDelta
   - Si quantityAvailable = 0 → isActive = false
   - Si quantityAvailable > 0 y era false → isActive = true

c. Crear inventory_movement:
   - movementType = ADJUSTMENT_IN o ADJUSTMENT_OUT
   - quantityDelta = +N o -N
   - referenceType = MANUAL_ADJUSTMENT
   - referenceId = generado (o id de un documento de ajuste)
   - notes = motivo

d. Actualizar cached counter:
   - products.stock += quantityDelta
```

### 7.6 Cancelación de Venta (Revert)

```
POST /api/sales/:id/cancel

DENTRO DE UNA TRANSACCIÓN:

Para cada sale_item con lotId != NULL:

1. Recuperar el lote: inventory_lots WHERE id = sale_item.lotId

2. Actualizar inventory_lot:
   - quantityAvailable += sale_item.quantity
   - isActive = true (si estaba false)

3. Crear inventory_movement:
   - movementType = CANCEL_REVERT
   - quantityDelta = +sale_item.quantity
   - referenceType = SALE
   - referenceId = sale.id
   - notes = "Reversión por cancelación de venta #ORDER_NUMBER"

4. Actualizar cached counter:
   - products.stock += sale_item.quantity

5. Actualizar sale.status = CANCELLED
```

---

## 8. Reglas de Negocio y Validaciones

### Reglas de Inventario

| # | Regla | Enforzada en |
|---|-------|--------------|
| R1 | `quantityAvailable >= 0` siempre | Constraint SQL + validación en lógica |
| R2 | No se puede vender un PRODUCT sin stock suficiente | Validación al crear sale_item |
| R3 | `products.stock` debe ser == `SUM(lots.quantityAvailable)` | Mantener sync, agregar job de reconciliación |
| R4 | Un `inventory_movement` nunca se edita ni elimina | Sin `updatedAt`/`deletedAt` en la tabla |
| R5 | Una `purchase_order` CONFIRMED no se puede cancelar | Solo DRAFT → CANCELLED |
| R6 | Para ajustar una compra confirmada, usar movimientos de ajuste | Nunca editar lotes directamente |
| R7 | Cada `sale_item` de tipo PRODUCT debe tener `lotId` | Validación al crear |
| R8 | `quantityDelta` en movimientos debe ser != 0 | Constraint SQL |
| R9 | `notes` obligatorio en movimientos de tipo ADJUSTMENT_* | Validación en lógica |

### Reglas de Precios

| # | Regla | Detalle |
|---|-------|---------|
| P1 | El precio de venta sugerido al vender es `lot.unitSalePrice` | El vendedor puede ajustarlo |
| P2 | El `snapshotPurchasePrice` en sale_items viene del lote consumido | Para margen real |
| P3 | `products.currentPurchasePrice` / `currentSalePrice` se actualizan al confirmar compra | Para listados rápidos |
| P4 | `currentPurchasePrice` / `currentSalePrice` se llenan con el valor del último lote | Cached refs para listados y cotizaciones |

---

## 9. Casos Edge y Corrección de Errores

### Caso A: Error en cantidad de compra (lote sin ventas)

```
Situación: Cargué 10 monturas, eran 8. Lote sin ventas.
Acción: Crear ADJUSTMENT_OUT de 2 unidades sobre el lote.
Motivo: "Corrección de carga PO-0001: cantidad real era 8, no 10"
Resultado: quantityAvailable = 10 - 2 = 8 ✓
```

### Caso B: Error en cantidad de compra (lote con ventas parciales)

```
Situación: Cargué 10, eran 8. Ya vendí 6, quedan 4 en lote.
Acción: Crear ADJUSTMENT_OUT de 2 unidades (4 - 2 = 2 ok, no excede disponible)
Motivo: "Corrección de carga PO-0001: cantidad real era 8"
Resultado: quantityAvailable = 4 - 2 = 2 ✓
```

### Caso C: Error en cantidad donde ya vendí más de las reales

```
Situación: Cargué 10, eran 8. Ya vendí 9, queda 1 en lote.
Problema: No puedo hacer ADJUSTMENT_OUT de 2 porque solo queda 1.
Acción: ADJUSTMENT_OUT de 1 (lo que queda). El sistema muestra advertencia:
        "Solo se puede ajustar 1 unidad. 1 unidad del error ya fue vendida."
Motivo: "Corrección parcial de carga PO-0001: cantidad real era 8, ya vendidas más de lo real."
```

### Caso D: Item equivocado en compra (lote sin ventas)

```
Situación: Cargué "Montura Ray-Ban" pero era "Montura Lacoste"
Acción:
1. ADJUSTMENT_OUT de toda la quantityAvailable del lote equivocado
   Motivo: "Item incorrecto en PO-0001: era Lacoste, no Ray-Ban"
2. Crear nueva compra (purchase_order) con el item correcto
3. El lote equivocado queda con quantityAvailable = 0, isActive = false
   pero con historial completo.
```

### Caso E: Item equivocado en compra (lote con ventas)

```
Situación: Cargué "Montura X" pero era "Montura Y". Ya vendí 3.
Acción:
1. Las 3 ventas YA están hechas con snapshots — no se tocan.
2. ADJUSTMENT_OUT del stock restante del lote equivocado.
   Motivo: "Item incorrecto en PO-0001. Unidades ya vendidas permanecen en historial."
3. Crear nueva compra con el item correcto para reponer si es necesario.
```

### Caso F: Precio equivocado en compra confirmada

```
Situación: Puse $80 pero era $90.

Acción:
1. Editar directamente el lote:
   - inventory_lots.unitPurchasePrice = 90
   - inventory_lots.unitSalePrice = nuevo precio de venta (si aplica)
   - El lote tiene updatedAt → queda registro del cambio.

2. change_history captura automáticamente:
   - Entidad: inventory_lot, id del lote
   - Campo: unitPurchasePrice
   - Valor anterior: 80, Valor nuevo: 90
   - Quién y cuándo

3. Si es el lote más reciente del producto:
   - Actualizar products.currentPurchasePrice / currentSalePrice

4. Las ventas YA realizadas con este lote NO se tocan:
   - sale_items.snapshotPurchasePrice quedó con 80 (inmutable)
   - El margen real de esas ventas refleja el error original

NOTA: NO se crea inventory_movement. Los movimientos son exclusivamente
      para cambios de CANTIDAD. Los cambios de precio se auditan en
      change_history.
```

---

## 10. Plan de Migración

### Fase 1: Schema (Fresh — DROP y CREATE)

> **No hay migración incremental.** Se dropean todas las tablas y se crean desde cero con el schema limpio.

```
Orden de creación (por dependencias de FK):

1. Crear enums nuevos:
   - purchase_order_status
   - inventory_movement_type
   - movement_reference_type
   - purchase_order_item_type

2. Crear tablas nuevas:
   - purchase_orders
   - purchase_order_items
   - inventory_lots
   - inventory_movements

3. Recrear products SIN los campos legacy:
   - ELIMINAR: purchasePrice, salePrice, purchaseCurrency,
     purchaseCurrencyRate, purchaseUsdBcvRate, purchaseDate, normalizedCostUsd
   - CAMBIAR: stock → NOT NULL DEFAULT 0
   - AGREGAR: currentPurchasePrice, currentSalePrice

4. Recrear sale_items CON campos nuevos:
   - AGREGAR: lotId (FK → inventory_lots), snapshotPurchasePrice

5. Regenerar migración con `pnpm drizzle-kit generate`
6. Aplicar con `pnpm drizzle-kit migrate`
7. Re-seed datos de prueba si es necesario
```

### Fase 2: Lógica de Negocio

```
Archivos a crear/modificar:

NUEVOS:
- src/lib/server/db/schema/purchaseOrders.ts
- src/lib/server/db/schema/inventoryLots.ts
- src/lib/server/db/schema/inventoryMovements.ts
- src/lib/server/db/queries/purchaseOrders.ts
- src/lib/server/db/queries/inventoryLots.ts
- src/lib/server/db/queries/inventoryMovements.ts
- src/lib/shared/enums/purchaseTypes.ts
- src/lib/shared/enums/inventoryTypes.ts

MODIFICAR:
- src/lib/server/db/schema/products.ts (eliminar campos legacy, agregar nuevos)
- src/lib/server/db/schema/sales.ts (lotId en sale_items)
- src/lib/server/db/schema/index.ts (re-exports)
- src/lib/server/db/queries/sales.ts (FIFO logic)
- src/lib/server/db/queries/products.ts (sync stock)
- src/lib/shared/enums/index.ts (re-exports)
```

### Fase 3: UI (fuera de alcance de este plan)

- Página de Compras (CRUD + confirmación)
- Página de Ajustes de Inventario
- Modificar flujo de creación de venta (validar stock FIFO)
- Dashboard de inventario (stock por lote)

---

## 11. Checklist de Implementación

### Etapa 1: Enums y Tipos
- [ ] Crear `src/lib/shared/enums/purchaseTypes.ts`
- [ ] Crear `src/lib/shared/enums/inventoryTypes.ts`
- [ ] Actualizar `src/lib/shared/enums/index.ts`

### Etapa 2: Schema (tablas nuevas)
- [ ] Crear `src/lib/server/db/schema/purchaseOrders.ts` (purchase_orders + purchase_order_items)
- [ ] Crear `src/lib/server/db/schema/inventoryLots.ts`
- [ ] Crear `src/lib/server/db/schema/inventoryMovements.ts`
- [ ] Actualizar `src/lib/server/db/schema/index.ts` (barrel exports)

### Etapa 3: Schema (modificar existentes)
- [ ] Modificar `src/lib/server/db/schema/products.ts` (eliminar campos legacy: `purchasePrice`, `salePrice`, `purchaseCurrency`, `purchaseCurrencyRate`, `purchaseUsdBcvRate`, `purchaseDate`, `normalizedCostUsd`. Agregar `currentPurchasePrice`, `currentSalePrice`, stock → NOT NULL)
- [ ] Modificar `src/lib/server/db/schema/sales.ts` (lotId + snapshotPurchasePrice en sale_items)

### Etapa 4: Migración SQL (Fresh)
- [ ] DROP todas las tablas existentes
- [ ] Generar migración limpia con `pnpm drizzle-kit generate`
- [ ] Revisar SQL generado manualmente
- [ ] Aplicar migración con `pnpm drizzle-kit migrate`

### Etapa 5: Queries
- [ ] Crear `src/lib/server/db/queries/purchaseOrders.ts`
- [ ] Crear `src/lib/server/db/queries/inventoryLots.ts`
- [ ] Crear `src/lib/server/db/queries/inventoryMovements.ts`
- [ ] Modificar `src/lib/server/db/queries/sales.ts` (FIFO en createSaleItem)
- [ ] Modificar `src/lib/server/db/queries/products.ts` (stock sync helpers)

### Etapa 6: Validación Zod
- [ ] Crear schemas de validación para purchase orders
- [ ] Crear schemas de validación para ajustes de inventario

### Etapa 7: Tests
- [ ] Test: confirmar PO genera lotes + movimientos + actualiza stock
- [ ] Test: venta FIFO consume lote correcto + genera movimiento
- [ ] Test: venta sin stock suficiente → error
- [ ] Test: cancelación de venta revierte stock + genera movimiento
- [ ] Test: ajuste manual positivo/negativo
- [ ] Test: ajuste no puede dejar quantityAvailable < 0
- [ ] Test: PO CONFIRMED no se puede cancelar
- [ ] Test: stock cached == sum(lotes.quantityAvailable)

### Etapa 8: Seed de Datos
- [ ] Actualizar `scripts/seed-demo.ts` para crear POs de ejemplo con lotes
- [ ] Validar que el seed genera stock correcto via lotes

---

## Decisiones Resueltas

| # | Decisión | Resolución |
|---|----------|------------|
| D1 | ¿Un sale_item puede consumir de múltiples lotes? | **No split.** 1 sale_item = 1 lote. Si no alcanza, error. El vendedor ajusta la cantidad. |
| D2 | ¿Usar pgEnum o varchar para los tipos nuevos? | **pgEnum.** Alineado con el patrón existente (`sale_item_type`, `lens_catalog_source`, etc.). |
| D3 | ¿`doublePrecision` o `numeric` para precios en tablas nuevas? | **doublePrecision.** Consistente con el schema actual. |
| D4 | ¿Cambiar `purchasePrice`/`salePrice` semántica o deprecar? | **ELIMINAR.** Schema fresh — se dropean todos los campos de compra legacy. Solo quedan `currentPurchasePrice` / `currentSalePrice` como cached refs. |
| D5 | ¿`lotNumber` auto-incremental o formato? | **Integer secuencial.** Consistente con `orderNumber` en sales/quotes. | 

---

*Última actualización: Abril 2026*
*Este plan debe aprobarse antes de iniciar implementación.*
