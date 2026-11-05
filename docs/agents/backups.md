# backups (AGENTS.md de dominio)

> Ver root `AGENTS.md` para reglas globales. Este doc solo agrega reglas de este dominio.
> Mapeo ruta→dominio: `scripts/agents-domains.json`. El check de CI avisa si este doc queda desincronizado.

## Purpose

UI super-admin para historial/estado de backups de PostgreSQL + trigger manual vía API de Dokploy. El backup real corre en Dokploy como Schedule Job (container efímero alpine: pg_dump → gzip → rclone a Google Drive → retention → webhook). Spec: `docs/specs/backup-dokploy-spec.md`, plan `docs/plans/backup-dokploy-migration.md`.

## Scope

`components/backups/**`, `routes/(app)/backups/**`, `routes/api/internal/backup-webhook/**`, `remote/backups.remote.ts`.

## Reglas de dominio / invarianzas

- **Todo command requiere `requireUserAdmin()` (solo ADMIN, no MANAGER)** (`remote/backups.remote.ts:58,64,120`).
- ⚠️ El historial NO se consulta a GDrive ni Docker: los datos son **solo** las notificaciones `BACKUP_CREATED/BACKUP_FAILED` en la tabla `notifications` (`backups.remote.ts:53-61`, spec `:414-419`).
- Estado derivado por antigüedad de la última notificación: <26h healthy, <50h stale, si no failing (o si la última falló); sin historial = unknown (`:63-115`). Umbrales = cron 2:00AM + margen.
- ⚠️ **Webhook de seguridad por token**: `Authorization: Bearer ${BACKUP_NOTIFY_TOKEN}` exacto. Sin env configurado → **503** (señal "no configurado", no 401); sin match → 401; JSON inválido o sin filename → 400 (`routes/api/internal/backup-webhook/+server.ts:7-27,29-42`).
- ⚠️ La ruta `api/internal/backup-webhook/` **no** tiene `locals.user` — su única protección es el token; debe permanecer bajo `api/internal/` y jamás exponerse en el app público.
- `status === 'error'` en el body → `notifyBackupFailed`, si no success; `size` string humana parseada a bytes (regex + multiplicadores B/KB/MB/GB); no-parseable → undefined (`:29-55`).
- **Trigger manual (`runBackup`)**: valida 3 envs (`DOKPLOY_API_URL/API_KEY/BACKUP_SCHEDULE_ID`) con errores descriptivos; distingue 404/HTML (proxy mal apuntado) del error genérico mostrando el body (`backups.remote.ts:126-149`). Endpoint correcto: `POST /api/schedule.runManually` con `x-api-key` — el spec viejo decía `schedule/trigger`, **el código manda**.
- El trigger es asíncrono: responde "iniciado"; el resultado llega después al webhook como notificación (`:151`).

## Patrones locales

- Página `/backups` con handlers async planos (`fetchAll`/`handleRunBackup`, sin hook de commands), badge de estado y lista plana de hasta 50 filas (`listBackupHistory({limit:50})`, `DataGrid` sin props de paginación); sidebar lo expone solo en `SUPER_ADMIN_ITEMS`.
- `parseSize` es util local del webhook (+server.ts) — no reutilizar para otros formatos sin decisión.

## Testing

- Hueco: sin tests dedicados; verificación manual según el plan del spec (`backup-dokploy-spec.md:423-433`).

## Known gaps / tech debt

- 🟡 Sin dedupe: si Dokploy re-lanza el webhook, se duplican notificaciones de backup.
- 🟡 El payload del webhook no persiste `timestamp` (el spec lo menciona pero el evento no lo guarda) y no valida con Zod (solo exige filename).
- 🟡 Si la DB está caída el webhook **responde 200 igual**: `publishNotification` traga el error (`notifications/service.ts:29-45`) y la notificación se pierde en silencio — sin retry del remitente. Además el spec `backup-dokploy-spec.md:318` menciona `useCommand()`, que no existe en el código.
