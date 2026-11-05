# lenses (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Catálogo de cristales (LAB tallado vs FINISHED terminado) con tecnologías de laboratorio, materiales ópticos propios (`lens_materials`, separados de los materiales de producto), rangos ópticos y modo de inventario ON_DEMAND/STOCK; diferenciadores como tags libres.

## Scope

`components/lenses/**`, `routes/(app)/lenses/**`, `remote/lenses/**`, `queries/lenses/**`, `schemas/lenses*`, `schema/lenses.ts`, enums `shared/enums/lensTypes.ts`.

Owner rules: el stock de lentes-STOCK lo gestiona `inventory` (ajustes con lotes FIFO, `adjustLensStock`); la recepción proviene de `purchases` (lifecycle). Los consumos de venta con cristales ON_DEMAND tocan solo contadores (`sales` doc se refiere acá).

## Reglas de dominio / invarianzas

**Clasificación** (`shared/enums/lensTypes.ts:7-34`, `schema/lenses.ts:27-30`)

- `LensType` (MONOFOCAL/BIFOCAL/PROGRESSIVE/OCCUPATIONAL), `LensCatalogSource` (LAB/FINISHED), `LensPriceType` (UNIT/PAIR), `LensInventoryMode` (ON_DEMAND/STOCK). Enums PG derivados con `enumValues()`.
- ⚠️ **FINISHED exige ≥ 1 rango óptico** (prescripción fija); LAB no — `schemas/lenses.ts:190-193`.
- Dependent: `technologyId` nullable — FINISHED no usa tecnología de diseño (`schema/lenses.ts:112-117`).

**Precios**

- `pairPurchasePrice` es **derivado**: `unitPurchasePrice = UNIT → base×2, PAIR → base` (`shared/pairPurchasePrice.ts:12`) y **nunca incluye montaje/envío**. Se recalcula en cada create/update desde `(basePrice, priceType)` efectivo; jamás se edita directo (`remote/lenses/catalog.remote.ts:125`, `catalog-update.remote.ts:127-130`).

**Stock**

- Regido por `inventoryMode`: ON_DEMAND → `stock: null`; STOCK → valor dado (`catalog.remote.ts:122-123`, `catalog-update.remote.ts:123-125`).
- **Ajuste manual (STOCK)** — `catalog-stock.remote.ts:54`: solo ADMIN; rechaza items ON_DEMAND (`:64`); FIFO sobre lotes activos (`:78`); sin lote y salida → error (`:81`); sin lote y entrada → crea **PO CONFIRMADA fantasma** con precios 0 para anclar el lote (`:96-137`, deuda abajo); salida sin `CUSTOMER_RETURN` registra `unitCostAtAdjustment` para el reporte de cash (`:199-207`); movimiento + update de stock cacheado en la MISMA tx (`:159-236`).

**Rangos ópticos** (`schema/lenses.ts:199-229`)

- Cascade delete por ítem. Se normaliza min≤max (cyl/add) al insertar (`catalog.remote.ts:158-171`).
- En update se comparan **semánticamente** (`rangesAreEqual`) y solo se hace delete+reinsert si cambiaron, con summary humano para audit — `catalog-update.remote.ts:166-211,232-237`; helpers en `remote/lenses/shared.ts:57-99`.
- Validación cruzada de pares del form (min≤max, pares juntos): `schemas/lenses.ts:67-99`.

**Arrays PG y tags**

- `differentiators`, `arColors`, `photochromicColors` son arrays PG con **índices GIN** (`schema/lenses.ts:121,174-176`); el form envía JSON string que se parsea (`StringArraySchema`, `schemas/lenses.ts:119-134`).
- Rename/remove de diferenciadores afecta a **todos** los ítems activos con `array_replace`/`array_remove` (`queries/lenses/technologies.ts:117-144`) — ⚠️ operación global, no por ítem.

**Pénding resolution** (`queries/lenses/pending.ts`)

- `resolvePendingLensMaterial` upsert por nombre con código auto (1.ª versión: 10 chars upper sin chequear duplicados — deuda).
- `resolvePendingTechnology` prioriza tecnología **global** (supplier NULL) y luego la del supplier; si no existe, crea (`:21-97`); el form distingue con `isGlobalTechnology` (`catalog.remote.ts:102-120`).

## Patrones locales

- Búsqueda del catálogo: SQL de filtrado base + filtro/ranking **en memoria** sobre todos los ítems activos (`queries/lenses/catalog.ts:98-141`); el limit solo aplica cuando hay `q` (`catalog.remote.ts:29-31`).
- Audit: create excluye `ranges` del diff (`catalog.remote.ts:187-189`); update usa `calculateDiff` + rangos como summary y solo loguea si hay cambios (`catalog-update.remote.ts:229-241`).
- Formularios divididos: `components/lenses/form/{lensFormPricing,lensFormRanges,lensFormDisplay,lensFormPending}` — helpers puros con spec co-ubicado.

## Testing

- Unit: `components/lenses/form/*.spec.ts`, `components/lenses/detail/helpers.spec.ts`, `components/documentEditor/lensEditor.spec.ts`, `components/sales/helpers/lensConfirmation.spec.ts`, `schemas/lenses` (vía documentEditor).
- Hueco: sin specs para `queries/lenses/**` ni remotes.

## Known gaps / tech debt

- 🟡 `resolvePendingLensMaterial` no deduplica el `code` contra el unique index `ix_lens_materials_code` → colisión posible (`pending.ts:34-35`).
- 🟡 `renameDifferentiator`/`deleteDifferentiator` corren **sin transacción** ni verificación de impacto, afectando todos los ítems (`technologies.ts:117-144`).
- 🟡 Carga de catálogo: trae **todo** el catálogo y filtra/rankea en memoria; sin paginación real en `ListLensCatalogSchema` (`schemas/lenses.ts:205`) — escalará mal.
- 🟡 `createLensCatalogItem`/`updateLensCatalogItem` tienen query fns equivalentes sin uso (`queries/lenses/catalog.ts:218-291`) mientras la remote hace inserts inline — mover la responsabilidad a las query fns.
- 🟡 Impresión de cristales en PDF (tokens) tienen plan propio: `docs/plans/lens-receipt-fix.md` (activo).
