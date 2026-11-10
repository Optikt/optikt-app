# settings (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Singleton de datos del negocio (`settings`: nombre, tasa default, IVA, etc.) + perfil/cambio de contraseña del usuario. Mutaciones de settings de negocio son ADMIN-only.

## Scope

`routes/(app)/settings/**` + `(app)/config/**`, `components/config/**`, `remote/settings.remote.ts`, `remote/profile.remote.ts` (consumidor), `queries/settings.ts`, `schemas/settings*`, `schema/settings.ts`.

Owner rules: el perfil y autenticación pertenecen al dominio `users` — solo los schemas de perfil/contraseña viven en `schemas/settings.ts` (deuda abajo); la `defaultTaxRate` la consumen los dominios de documentos (`sales`/`quotes` via `computeSaleTotals`).

## Reglas de dominio / invarianzas

- **Singleton**: `getSettings()` auto-crea la fila única si no existe en el primer acceso (`queries/settings.ts:14-21`); `updateSettings` garantiza existencia vía `getSettings`.
- `defaultTaxRate`: 0..100, number, default 16 (`schema/settings.ts:16`).
- `updateSettingsForm` mapea con `|| undefined` para no pisar campos no enviados (`settings.remote.ts:33-42`) — preservar esa semántica partial-update.
- Campos de conteo físico (`countCycleDays` 30, `countDiffThresholdUnits` 2, `countDiffThresholdUsd` 0, `countQuickOldestLimit` 50 en `schema/settings.ts`): config del ciclo del dominio `inventory` — las reglas que derivan viven en `docs/agents/inventory.md` y `shared/inventoryCount.ts`; este dominio solo los persiste.

## Patrones locales

- Ruta `/settings` re-exporta el load de `/config` (`(app)/settings/+page.server.ts:1`); `config` carga settings solo si ADMIN (`config/+page.server.ts:9-14`).
- `SettingsPage.svelte` branchea Profile/Business por rol con `invalidateAll` tras guardar.

## Testing

- Hueco total: sin spec de queries ni schemas.

## Known gaps / tech debt

- 🟡 El singleton no es atómico — dos primeros accesos concurrentes podrían insertar 2 filas (no hay unique/upsert). Bajo riesgo, pero existe.
- 🟠 `UpdateProfileSchema`/`ChangePasswordSchema` viven en `schemas/settings.ts` pero se consumen desde `remote/profile.remote.ts` (dominio `users`) — schema doble-propósito; mover a `schemas/users*` al refactor.
