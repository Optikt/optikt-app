# suppliers (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

CRUD de proveedores + tratamientos de laboratorio (category/price/salePrice/isTaxable) + vínculo N:M proveedor↔marca, con reactivación desde soft-delete.

## Scope

`components/suppliers/**`, `routes/(app)/suppliers/**`, `remote/suppliers.remote.ts`, `queries/suppliers.ts`, `queries/brandSuppliers.ts`, `schemas/suppliers*` + `brandSuppliers*`, `schema/suppliers.ts`, `schema/brandSuppliers.ts`.

## Reglas de dominio / invarianzas

- Lectura `requireAuth`; escritura `requireAdmin` (`suppliers.remote.ts:57,97-399`).
- Soft-delete vía `softDelete('supplier'/'supplier_treatment', …, tx)` dentro de `db.transaction`; audit best-effort **después** del commit (`:202-208,406-416`).
- Nombre y RIF únicos entre activos; si el nombre casa con un eliminado → `reactivationCandidate` para confirmar (`:102-125`). ⚠️ RIF tiene **unique index global en DB** (`schema/suppliers.ts`) → el RIF queda reservado mientras exista el soft-deleted (lo mismo que usuarios, ver doc `users`).
- Reactivación = restore + limpiar trash (`:305-306`).
- **Tratamientos**: nombre único por proveedor (remoto `:346,376` + `uq_supplier_treatment_name`, `schema/suppliers.ts:73-74`), FK cascade al supplier, `price ≥ 0`, `salePrice` null = fallback al cost. Los tratamientos alimentan el costo snapshot de ítems TREATMENT en ventas (doc `sales` → `supplier_treatments.price`).
- **Vínculo marca-proveedor**: upsert onConflict (`:229-238`); desvincular **bloqueado si existen productos activos** con esa dupla (`:246-250`, `queries/brandSuppliers.ts:51-68`). El link es **hard-delete** físico (`brandSuppliers.ts:41-49`) — apropiado por ser tabla de unión.
- `resolvePendingSupplier` (`queries/suppliers.ts:204-228`): busca activo por nombre (ilike) o crea DISTRIBUTOR dentro de la tx del caller — patrón pendings del wizard.

## Patrones locales

- Overload de `getAllSuppliers` con proyección `columns` (`$dynamic()`, `suppliers.remote.ts:55-83`); filtros `deleted` opcionales en finders.
- Paginación **en memoria** en `listSuppliers` (`:60-86`).
- Quick-create defaults: `type='DISTRIBUTOR'`, teléfono placeholder `0000-0000000` (`:275-279`).

## Testing

- Hueco: sin specs dedicados (solo mención indirecta en `lensFormPending.spec`).

## Known gaps / tech debt

- 🟡 `listSuppliers` pagina/filtra en memoria sobre todos los proveedores (`:60-86`).
- 🟡 `deleteSupplierTreatmentById` usa softDelete aunque el nombre sugiere hard delete (`:394`) — aclarar/implementar.
- 🟡 Teléfono placeholder (`0000-0000000`) se persiste como dato real en quick-create.
- 🟡 Barrel `components/suppliers/index.ts` (consumible, no extendible).
