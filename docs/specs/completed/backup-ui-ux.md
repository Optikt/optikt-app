# Spec: backup-ui-ux

Scope: feature

# Backup UI/UX Spec (Super Admin)

## Route

`/backups` — under `(app)` layout, only visible to SUPER_ADMIN.

## Sidebar Entry

Add to `SUPER_ADMIN_ITEMS` in `src/lib/shared/routes.ts`:

```typescript
{ href: '/backups', label: 'Backups', icon: 'backup' }
```

Icon: use `Database` or `HardDrive` from `@lucide/svelte`.

## Page Layout (`src/routes/(app)/backups/+page.svelte`)

### Header

- Title: "Backups de base de datos"
- Badge showing status: "Cron activo" (green) / "Cron detenido" (red)
- Last backup: "Último backup: hoy 02:15 AM" or "Nunca"

### Action Bar (row of buttons)

- **🔄 Ejecutar backup ahora** — triggers runBackup(), shows loading spinner on button, disabled while running
- **🔄 Restart service** — triggers restartBackup(), shows confirmation modal: "¿Reiniciar el servicio de backup? Se ejecutará un backup al iniciar."
- **🔄 Refrescar lista** — re-fetches backup list from Drive

### Backups Table (using existing DataTable component)

Columns:

| Columna | Fuente           | Formato                                     |
| ------- | ---------------- | ------------------------------------------- |
| Archivo | rclone lsl       | `optikt-backup-2026-07-12_021500.sql.gz`    |
| Tamaño  | rclone lsl       | human readable: `64.2 MB`                   |
| Fecha   | rclone lsl       | `12 jul 2026, 02:15 AM`                     |
| Estado  | rclone exit code | ✅ Success / ❌ Error (from last run check) |

No inline actions (no download/delete in MVP). Future: add row actions.

### States

| State               | Behavior                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **Loading**         | Skeleton/spinner while fetching list from Drive (may take 1-3s)                                           |
| **Error**           | Toast error: "No se pudo obtener la lista de backups. Verifica que el container backup esté funcionando." |
| **Empty**           | "No hay backups disponibles. Ejecutá el primer backup manualmente."                                       |
| **Data**            | Table with pagination (default 10 per page)                                                               |
| **Run in progress** | Button disabled, shows "Ejecutando backup...". After done → toast "Backup completado" + auto-refresh list |

### Status Indicator Logic

Llamar `getBackupStatus` que verifica:

1. `pgrep crond` → cron alive?
2. Read `/tmp/backup-last-run` → cuando fue el último backup exitoso?

Return:

```typescript
interface BackupStatus {
	cronAlive: boolean;
	lastRunTimestamp: number | null; // unix seconds
	lastRunHuman: string | null; // "12 jul 2026, 02:15 AM"
	containerRunning: boolean;
}
```

Display:

- Green dot + "Cron activo" si cronAlive && lastRun < 26hs
- Yellow dot + "Sin actividad reciente" si cronAlive && lastRun > 26hs (o null)
- Red dot + "Cron detenido" si !cronAlive
- Si container no responde → mensaje: "Container de backup no disponible. Contactá al administrador del servidor."

## Remote Functions (`src/lib/remote/backups.remote.ts`)

### listBackups → `command(ListBackupsSchema, handler)`

- No input params needed
- Returns: `BackupFile[]`

### runBackup → `command(RunBackupSchema, handler)`

- No input params
- Returns: `{ success: true, message: 'Backup iniciado' }`
- Fire & forget (detached exec)

### restartBackup → `command(RestartBackupSchema, handler)`

- No input params (container name hardcoded server-side)
- Returns: `{ success: true, message: 'Servicio reiniciado' }`
- Calls Docker restart API

### getBackupStatus → `command(GetBackupStatusSchema, handler)`

- Returns: `BackupStatus`

## Auth

All remote functions use `requireUserAdmin()` guard — only SUPER_ADMIN role.

## Error Handling

- Docker API connection errors → user-friendly message: "No se pudo conectar con el servicio de backup."
- Exec errors (rclone, pgrep) → specific message based on exit code
- Network timeouts → "El servicio de backup no respondió a tiempo."
- All errors logged server-side with `console.error`
- Never leak stack traces or Docker API details to client
