# products (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Productos físicos (FRAME, SUNGLASSES, CONTACT_LENS, ACCESSORY) con SKU único, soft-delete/reactivación, atributos físicos por tipo y stock cacheado. `catalog.remote.ts` es el buscador ranqueado que alimenta los wizards de venta/compra y la edición de venta (nunca SSR del catálogo completo).

## Scope

`components/products/**`, `routes/(app)/products/**`, `remote/products.remote.ts`, `remote/catalog.remote.ts`, `queries/products.ts`, `schemas/products*` + `schemas/catalog*`, `schema/products.ts`, enums `shared/enums/productTypes.ts`.

Owner rules: los materiales del producto son del dominio `materials` (referenciados por `materialId`); el stock real vive en `inventory` (este dominio solo muta la caché a través de las fns de inventario).

## Reglas de dominio / invarianzas

**Tipos y materiales**

- `type` ∈ `ProductType` (FRAME/SUNGLASSES/ACCESSORY/CONTACT_LENS) — `shared/enums/productTypes.ts:8`; todos exigen tracking de stock (`STOCK_REQUIRED_TYPES`, `:49`).
- Materiales = tabla unificada del dominio `materials` con `productType`; SUNGLASSES comparte materiales de FRAME (`toMaterialCategory`, `productTypes.ts:111`). Los cristales ópticos NO viven acá (`lens_materials` del dominio `lenses`).
- Atributos físicos validados por tipo: FRAME/SUNGLASSES → `lensWidth/bridgeWidth (1-99)`, `templeLength (1-999)`; CONTACT_LENS → `baseCurve (5-10)`, `diameter (8-20)` (`schemas/products.ts:73-108`).
- `supplierId` y `materialId` **required**; `brandId` opcional (`products.remote.ts:191-193`).

**SKU**

- Regex `^[A-Z0-9-]+$`, max 50, uppercase forzado (`schemas/products.ts:26`); unique index que **incluye soft-deleted** (`schema/products.ts:70`) → toda creación debe re-chequear dentro de tx (`products.remote.ts:165`).
- Colisión con SKU existente: detecta candidato de reactivación fuera de tx y **reactiva como race-guard dentro de tx** (`products.remote.ts:123,169`), no se crea activo duplicado.

**Caché de stock — crítico**

- ⚠️ `products.stock` = proyección de `SUM(inventory_lots.quantityAvailable)`. Se muta SOLO via `incrementProductStock`/`decrementProductStock` con `executor: DbOrTx`, dentro de transacciones (`queries/products.ts:369,387`). Nunca UPDATE directo de stock.
- `currentPurchasePrice/currentSalePrice` provienen del lote más reciente (`schema/products.ts:44-47`). Cambiar precio de venta = `updateSalePriceCmd` (`products.remote.ts:361`).
- El inventario es la fuente de verdad; si drift de stock, se corrige con ajustes del dominio `inventory`, no re-normalizando la columna.

**Entidades pendientes (inline-create del wizard)**

- `pendingBrand/pendingSupplier/pendingMaterial` se resuelven en la **misma tx** de creación (`resolvePending*`, `products.remote.ts:145-158`) + `upsertBrandSupplierLink` (`:161`).
- IVA: `isTaxable` default true para productos; el catálogo de cristales es exento (default false) — ver `schema/products.ts:53`.

**Soft-delete / restore**

- Via dominio `trash` (`softDelete('product')`) + restore; audit después del tx (`products.remote.ts:310-358`); búsqueda soporta `deleted: 'exclude'|'only'|'include'` (`queries/products.ts:303`).

**Catálogo POS** (`remote/catalog.remote.ts`, `schemas/catalog.ts`)

- `searchCatalog` combina productos + ítems de cristales en paralelo; limit default 20, max 50 (`catalog.remote.ts:19`); `q` vacío sin supplierId → arrays vacíos.
- `getCatalogItemsByIds` siembra la caché del wizard en edición de venta (`:41`).

## Patrones locales

- Listado paginado con joins parciales (brand/supplier/material) + token search con ORDER BY relevancia (`queries/products.ts:69,88-93,168-173`).
- `UpdateProductSchema = Create.partial() + id` (`schemas/products.ts:111`).
- Formularios por secciones (`components/products/form/*`: General/Pricing/Stock/FrameAttributes/ContactLensFields) + `pendingEntities.ts` para inline-create.

## Testing

- Unit: `schemas/products.spec.ts`, `schemas/catalog.spec.ts`, `utils/productName.spec.ts`, `shared/enums/productTypes.spec.ts`, specs de `components/products/{adjustments,detail}/`.
- Hueco: sin spec para `queries/products.ts`.

## Known gaps / tech debt

- 🟡 TODOs en `createProduct`: validar que las entidades pendientes resueltas no estén **soft-deleted** (`products.remote.ts:134,141`) — puede fallar o duplicar entidades padre.
- 🟡 `products.stock` cacheado sin constraint DB que garantice igualdad con la SUM de lotes; divergencia solo se corrige con ajustes manuales de `inventory`.
- 🟡 `updateSalePrice` audit usa cast `as never` (`products.remote.ts:370-377`).
- 🟡 Barrels legacy en `components/products/**` (y `lenses/**`) — consumibles, no extendibles.
