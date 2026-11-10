# materials (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Tabla unificada de materiales por categoría (FRAME —cubre también SUNGLASSES—, CONTACT_LENS, ACCESSORY). Los cristales ópticos NO viven acá: tienen `lens_materials` propias en el dominio `lenses` (`schema/materials.ts:3-14`).

## Scope

`components/materials/**`, `routes/(app)/materials/**`, `remote/materials.remote.ts`, `queries/materials.ts`, `schemas/materials*`, `schema/materials.ts`, helper `utils/materialCodes.ts`.

## Reglas de dominio / invarianzas

- Unicidad `(name, productType)` y `(code, productType)` — unique indexes (`schema/materials.ts:39-48`).
- ⚠️ Duplicados se chequean en la remote **fuera de tx** (`materials.remote.ts:92,109,150-163`) — ver deuda de race condition.
- Creación duplicada: si existe activo → `invalid`; si existe soft-deleted → devuelve **candidato de reactivación** para confirmar (nunca duplicado silencioso, `:98`).
- `productType` es string sin FK/enum en la BD (`schema/materials.ts:22`); el cerco es Zod `MATERIAL_CATEGORIES` (`schemas/materials.ts:26`) — no relajar sin decidir qué pasa con referencias existentes.
- Mutaciones solo ADMIN (`:186-204`); soft-delete vía dominio `trash` + audit después de la tx.
- Reactivación = 2 pasos: restaura material **y** limpia su entrada de trash (`:247-268`).
- `quickCreateMaterial` (inline del wizard) es idempotente: devuelve el existente y genera código único de forma iterativa (`materials.remote.ts:210-242`, `queries/materials.ts:37-52`), vía `buildMaterialCode` (`$lib/utils/materialCodes`).

## Patrones locales

- Paginación/orden de campo compartidos con `products` (`queries/materials.ts`).
- Cambiar `productType` de un material asignado a productos **no migra referencias** (`materials.remote.ts:166-171`) — tratar como cambio de datos con revisión humana, no como CRUD normal.

## Testing

- Unit: `schemas/materials.spec.ts`, `utils/materialCodes.spec.ts`.
- Hueco: sin specs para `queries/materials.ts` ni remotes.

## Known gaps / tech debt

- 🟡 Chequeos de duplicado/reactivación fuera de transacción → race conditions (dos creaciones simultáneas pueden insertar dos activos con mismo name+productType).
- 🟡 Cambio de `productType` permitido sin migración de referencias (`materials.remote.ts:166-171`).
