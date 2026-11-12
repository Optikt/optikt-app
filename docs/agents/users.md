# users (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

Login (Argon2), sesiones con token hash + vivacidad, gestión de usuarios ADMIN-only con soft-delete/reactivación y guards de rol reutilizables.

## Scope

`components/users/**`, `components/forms/**`, `routes/(auth)/**`, `routes/(app)/users/**`, `remote/users/**`, `remote/auth.remote.ts`, `remote/profile.remote.ts`, `server/auth*`, `server/guards.ts`, `server/actionContext.ts`, `queries/users.ts`, `queries/sessions.ts`, `queries/userPreferences.ts`, `schemas/users*` + `schemas/auth.ts`, `schema/users.ts`, `schema/sessions.ts`, `schema/userPreferences.ts`, lógica pura `shared/user-deletion-rules*` + `shared/enums/roles.ts`.

## Reglas de dominio / invarianzas

**Roles y guards** (`shared/enums/roles.ts`, `server/guards.ts`)

- `ADMIN, MANAGER, SELLER, VIEWER`; `isAdminRole` = ADMIN|MANAGER; `canOperate` ≠ VIEWER; `canManageSaleByOwner` (SELLER solo sus ventas) — `roles.ts:41-73`.
- Guards: `requireAuth` (401), `requireRole(...)` (403), `requireAdmin` (ADMIN|MANAGER), `requireUserAdmin` (solo ADMIN) (`guards.ts:46-78`); `requirePageRole` para loads → redirect 302 a `/dashboard` (`:17-21`). Guarda la tabla de equivalencias: cash ADMIN|MANAGER, backups/trash/users solo ADMIN (según docs respectivos).

**Sesiones** (`server/auth.ts`)

- Token aleatorio base64url → **hash sha256** guardado con unique index (`auth.ts`); cookie `auth-session` httpOnly, `secure=!dev`, sameSite lax.
- Vida **30 días**, renovada si quedan < 15 (`auth.ts:62-68`).
- Usuario desactivado o sesión expirada → `deactivateSession` inmediata + cookie borrada (`hooks.server.ts:26-40`, `auth.ts:50-60`).
- Contraseñas: Argon2 con params explícitos `{memoryCost:19456, timeCost:2, outputLen:32, parallelism:1}` en login y registro (`remote/auth.remote.ts:31-36`, `remote/users/commands.remote.ts:166-171`) — no cambiar en un solo sitio.
- Cambio de contraseña propia exige verificar `currentPassword` antes del rehash (`profile.remote.ts:38-59`).

**Soft-delete vs desactivación** (dos estados distintos, `queries/users.ts:111-142`)

- `deleted_at` (papelera del dominio `trash`) vs `deactivated_at` (inactivo, bloquea login, `remote/auth.remote.ts:26-28`).
- No autodesactivar/autoeliminarse (`commands.remote.ts:313-317,355-358`); superusers no eliminables (`:351-353`); MANAGER no elimina ADMIN/MANAGER; **no se puede eliminar el último ADMIN** (`isLastAdmin` + `countActiveAdmins`, reglas puras en `shared/user-deletion-rules.ts`) — audit después de la tx (`:373-376`).
- Email/username única **entre activos**; si existe eliminado → `reactivationCandidate` (`commands.remote.ts:118-163`, `forms.remote.ts:42-87`). ⚠️ `ix_users_email` es unique **global** en DB (`schema/users.ts:32`) → el email queda reservado mientras exista el soft-deleted.

**Preferencias de usuario** (`schema/userPreferences.ts`, `queries/userPreferences.ts`, `remote/users/preferences.remote.ts`)

- Tabla `user_preferences` (PK compuesta `user_id + key`, `value jsonb`, FK a `users` con `ON DELETE CASCADE`): **crecer en preferencias no requiere migración** — agregar una preferencia nueva es agregar una rama al `UserPreferenceSchema` discriminado de `schemas/users.ts`.
- **Lectura en SSR**: el `+page.server.ts` llama directo a `getUserPreference(userId, key)` (no pasa por remote). **Escritura**: remote `saveUserPreference` (`command` + `requireAuth`, sin requisito de rol: VIEWER también guarda, es preferencia personal y no una acción de negocio).
- Preferencias actuales: `sales.view` = `'list' | 'grid'` (vista por defecto del listado de ventas, plan `sales-list-redesign`).
- Invariante: `?view=` en la URL tiene prioridad sobre la preferencia guardada y **nunca la pisa al cargar**; solo se guarda cuando el usuario cambia la vista (y si el guardado falla, se reintenta en silencio sin romper la UI).

**Rutas de layout**

- `(auth)/+layout.server.ts` redirige a `/dashboard` si ya logueado; `(app)/+layout.server.ts` protege todo el app → `/login` si no hay user.

## Patrones locales

- Remotes divididos `users/commands.remote.ts` + `users/forms.remote.ts` (split DT1 fase 4).
- Helpers puros testeables de reglas de eliminación en `shared/user-deletion-rules.ts` (matriz de roles con spec).
- `getActionContext` (`server/actionContext.ts`) empaqueta userId/role/ip/UA para audit — es el args estándar de los cores DT9.

## Testing

- `server/auth.spec.ts` (token/hash/cookie), `shared/user-deletion-rules.spec.ts` (matriz de roles). Hueco: sin int tests de login/creación de usuario.

## Known gaps / tech debt

- 🟠 Cambiar la contraseña propia **no invalida las otras sesiones** (`invalidateAllUserSessions` existe, `sessions.ts:108`, pero casi nadie la llama) — vector de seguridad real.
- 🟡 `listUsers` es `command()` y no `query(...)` (`commands.remote.ts:41`) — rompe la convención de lectura sin efectos.
- 🟡 Unique index global de email vs soft-delete: reactivar con email ya reasignado fallará por el índice (`restoreUser` es la vía).
- 🟡 Argon2 params duplicados en ~5 lugares — centralizar constantes.
- 🟡 `dbUpdateUser` sin audit (`commands.remote.ts:299`) y sin límite de sesiones por dispositivo.
- 🟡 Barrel `components/users/index.ts` (consumible, no extendible).
