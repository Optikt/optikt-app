# trash (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Registro unificado de master data soft-deleted: listado con label + restore. **Nunca purge definitivo** desde aquí.

## Scope

`routes/(app)/trash/**`, `remote/trash.remote.ts`, `queries/deletedItems.ts`, `schema/deletedItems.ts`.

## Reglas de dominio / invarianzas

- `deletedItems` es un registro espejo con **unique(entityType, entityId)** y snapshot JSONB para labels sin UNION (`schema/deletedItems.ts:20-50`). `DeletedEntityType = EntityType | 'user'`.
- ⚠️ `softDelete(entityType, id, deletedBy, executor)` **exige estar en una tx** y hace snapshot → soft-delete del dominio → insert del registro, atómico (`queries/deletedItems.ts:224-248`). Todo dominio que borra master data (products, brands, customers, lenses, suppliers, users…) debe llamarlo **dentro** de su `db.transaction`, no aparte.
- `restoreItemCmd` limpia `deleted_at` y borra el registro en la MISMA tx (`trash.remote.ts:26-35`); falla si no está en papelera. Todo ADMIN-only.
- El registro cubre solo master data: sales/compras/quotes **no** pasan por aquí — sus "eliminaciones" (cancel/void) siguen las reglas de sus dominios.

## Patrones locales

- **Registry/adapter**: `REGISTRY` mapa entityType → `{softDelete, snapshot, label}` y `RESTORE` para volver a `deletedAt: null` (`deletedItems.ts:44-211`). Agregar entidad borrable = registrar 2 entradas + label. El snapshot de user esquiva `hashedPassword`.
- Label resuelta server-side (`trashLabel` en remote), no en UI.

## Testing

- Hueco total: sin spec de `deletedItems.ts` ni de restore.

## Known gaps / tech debt

- ~~🟡 `restoreItemCmd` no re-valida colisiones de dominio al restaurar~~ **Aclarado (2026-11-17, verificado contra `drizzle/0000` + schema):** imposible por diseño. Todos los unique keys del registry (`users.email/username`, `customers.idNumber`, `suppliers.rif`, `brands.name`, `products.sku`, `materials.name+productType/code+productType`, `lens_materials.name/code`, `supplier_treatment.supplierId+name`) son **índices globales sin `WHERE deleted_at`** — una fila soft-deleted sigue ocupando su key, así que un duplicado no puede existir al momento de restaurar (el INSERT/UPDATE conflictivo falla antes, en create/reactivate, donde ya existen flows de reactivación). `lens_technologies`, `lens_catalog_items` y `prescriptions` no tienen uniques. No se agrega re-validación: sería código muerto. Si algún día un índice se vuelve parcial (`WHERE deleted_at IS NULL`), ahí sí agregar el check en `restore()`.
- 🟡 Registry cubre 11 tipos master data; entidades nuevas deben registrar el adapter (fallará silenciosamente a no figurar en la papelera).
