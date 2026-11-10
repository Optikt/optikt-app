# brands (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

CRUD de marcas con soft-delete/reactivación, vínculo marca↔proveedor, y **accesorios incluidos**: fórmulas por marca + overrides por producto FRAME/SUNGLASSES consultadas por el asistente de venta para armar ítems `FREE_ITEM` (`components/sales/step2/SaleStep2Items.svelte:5`).

## Scope

`components/brands/**`, `components/accessories/**`, `routes/(app)/brands/**`, `remote/brands.remote.ts`, `remote/brandAccessories.remote.ts`, `queries/brands.ts`, `queries/brandAccessories/**`, `schemas/brands*` + `brandAccessories*`, `schema/brands.ts`, `schema/brandAccessories.ts`.

Owner rules: el proveedor es del dominio `suppliers` (`*brandSuppliers*` → ese doc); los `FREE_ITEM` resultantes pertenecen a la venta (`sales`).

## Reglas de dominio / invarianzas

**Marcas**

- Nombre único entre activas (case-insensitive, índice `ix_brands_name`); si el nombre corresponde a una marca eliminada se devuelve `reactivationCandidate` para confirmar, nunca se duplica (`brands.remote.ts:91-97`).
- Solo ADMIN crea/edita/elimina/reactiva (`brands.remote.ts:86,122,156,275`); lectura `requireAuth`.
- Reactivación = restore + limpiar entrada de trash (`:286-287`); audit **después** de la tx (`:166-172`).
- Desvincular proveedor está **bloqueado con productos** asociados: `countProductsByBrandSupplier > 0` dentro de la tx (`:233-237`).

**Accesorios incluidos** (`queries/brandAccessories/**`)

- El accesorio debe ser type ACCESSORY; el producto anfitrión debe pertenecer a la marca y ser FRAME/SUNGLASSES (`internal.ts:227-258`).
- `priceMode CUSTOM` exige `customPrice > 0`, y `customPrice` solo puede existir en CUSTOM (doble: fns `internal.ts:69-87` + schema `schemas/brandAccessories.ts:39-58`).
- **Resolución de reglas**: si el producto tiene overrides activos → se usan SOLO las del producto; si alguna override está inactiva → `[` vacía; sin override → reglas activas de marca (`productId IS NULL`) — `reads.ts:27-37`.
- `toggleProductOverride` usa filas-marcador (`accessoryProductId = null`) para recordar "deshabilitado" cuando no hay accesorios (`writes.ts:96-179`); upsert con override borra el marcador y reactiva filas inactivas (`internal.ts:197-225`).

## Patrones locales

- Split reader/writer/internal/types en `queries/brandAccessories/`.
- Todas las writes aceptan `DbOrTx`; remote shell fino (auth + tx + delegación).

## Testing

- Hueco: **no hay specs** de `brands*` ni `brandAccessories*` (cobertura solo indirecta vía venta).

## Known gaps / tech debt

- 🟠 El marcador `accessoryProductId: null` con `priceMode COURTESY` dummy es estado implícito en la tabla — frágil; no lo "limpies" sin rediseñar la semántica del toggle.
- 🟡 `listBrands` hace fetch-all + filtro/paginación en memoria (`brands.remote.ts:57-74`).
- 🟡 `normalizePriceConfig` duplica la validación del schema (`internal.ts:72-81`).
- 🟡 El delete no verifica `canDelete` server-side (el chequeo existe para el modal: `checkBrandCanDelete`) — agregar guard al command antes de confiar en él.
