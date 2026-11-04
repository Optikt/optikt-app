# history (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Audit trail field-level por entidad: modal de historial con diff de valores (old→new) y paginación. La **escritura** no vive acá: `change_history` se escribe vía `$lib/server/audit` (best-effort post-transacción, regla global).

## Scope

`components/history/**`, `remote/history.remote.ts`, `queries/changeHistory.ts`, `schema/changeHistory.ts`. La vista de movimientos de inventario/pagos por producto/venta pertenece a `inventory`/`sales`.

## Reglas de dominio / invarianzas

- `changeHistory.changes` es JSONB `{field: {old,new}}` + snapshot opcional pre-cambio (`schema/changeHistory.ts:39-40`); `changedById` es `set null` — el registro sobrevive al borrado del usuario.
- ⚠️ `ALL_ENTITY_TYPES` (`schema/changeHistory.ts:64-89`, lista escrita a mano de 25 tipos) es la fuente de verdad tanto del schema como del enum de `trash` (`DeletedEntityType`) — **agregar nuevas entidades auditadas exige actualizarla**, no la olvides.
- Enums de entityType y cambio de label: tocar `schema/changeHistory.ts` y `remote/history.remote.ts:40-65` (validación).

## Patrones locales

- Remote de un solo endpoint `getHistory` con limit/offset/hasMore; `entityType` validado contra `ALL_ENTITY_TYPES`.
- `ChangeHistoryModal` (fetch lazy al abrir) + `ChangesDiff` (render old→new).
- Extras en el query file: timeline fusionada de PO + sus pagos con sub-select y orderBy asc (`changeHistory.ts:197-231`).

## Testing

- Hueco total: sin specs para queries ni componentes.

## Known gaps / tech debt

- 🟡 `deleteOldHistory/getRecentChanges/getUserChanges` parecen muertos (sin callers confirmados) — validar con `pnpm check:unused`/knip antes de asumir y borrar.
- 🟠 El enum manual de 25 entityTypes duplica implícitamente el schema (drift riesgo: entidades nuevas suelen olvidar actualizaciones).
- 🟡 Timeline de PO hardcodea `'purchase_order'/'purchase_order_payment'` como strings (`changeHistory.ts:197-231`).
