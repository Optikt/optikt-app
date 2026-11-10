# support (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Tickets de soporte: usuarios reportan bugs/pendiente de ayuda; ADMIN/MANAGER los triagean (status/priority + comentarios) con actividad anidada y notificación dirigida a admins.

## Scope

`components/support/**`, `routes/(app)/support/**`, `remote/supportTickets.remote.ts` (+ int spec), `queries/supportTickets.ts`, `schemas/supportTickets*`, `schema/supportTickets.ts`, reglas `shared/supportTickets.ts`.

## Reglas de dominio / invarianzas

- **Visibilidad**: ADMIN/MANAGER (`canManageSupportTickets`) ve todos y cambia status; el resto solo ve los suyos (`shared/supportTickets.ts:10-24`; filtro `createdById` en la lista y 403 per-ticket — `supportTickets.remote.ts:42-49,61-87`).
- Triage (status/priority) exclusivo de ADMIN (`requireAdmin`, `:148-151`) — más estricto que "managers ven todo".
- ⚠️ Update con **row lock** `findSupportTicketForUpdate` (`.for('update')`) dentro de la tx para que el diff from→to no quede stale (`queries/supportTickets.ts:151-164`).
- Cambio de status/priority → entrada de actividad con metadata `{statusFrom,statusTo}` / `{priorityFrom,priorityTo}`; solo-comentario si nada cambió; al set resolved terminal persiste `resolvedById/resolvedAt` y al reabrir se limpian (`remote:159-195`, `queries:204-216`).
- `number` es `serial` generado por DB con índice único — nunca por la app (`schema/supportTickets.ts:52,71`).
- Audit (logCreate + logCustom con diff old→new) **fuera de la tx**, tras commit (`remote:106,200-209`).
- Notificación ADMIN/MANAGER de creación **best-effort** con try/catch — fallo no rompe la creación del ticket (`remote:108-120`).
- Escapes de LIKE en búsqueda (`queries:78-81`); `perPage` máx 50 (`:98`).
- `countOpenSupportTicketsQuery` devuelve 0 para no-managers (`remote:51-59`); refresca UFO con window event `support-tickets-changed` (`shared:4`).
- Todas las writes en tx con `tx` a las query fns.

## Patrones locales

- Guards de permiso centralizados en helpers puros de `$lib/shared/supportTickets.ts` reutilizados por queries y remote.
- Componentes: tabla, badges, modal de form, historial de actividad.
- Regla de creación de notificaciones: **única excepción** al "insert solo via service" — los tickets insertan su propia notificación (documentado en doc `notifications-rates`).

## Testing

- `remote/supportTickets.int.spec.ts` (integración, queries cubiertas al 100%) + `schemas/supportTickets.spec.ts`.

## Known gaps / tech debt

- 🟡 Sin integración externa (Slack/email no existen — canal único in-app).
- 🟡 No hay "resolver directo" sin pasar por `updateSupportTicket` con status — el flujo siempre pasa por la misma función.
