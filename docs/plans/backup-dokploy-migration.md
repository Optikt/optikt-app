---
plan name: backup-dokploy-migration
plan description: Dokploy cron + backup UI
plan status: active
---

## Idea
Migrar el sistema de backups de un container long-running con busybox crond (frágil, DNS stale tras días) a un modelo efímero ejecutado por el cron de Dokploy. En paralelo, crear una UI de backups para el superadmin en optikt-app que muestra historial, status y permite ejecutar backups manualmente.

El problema actual no es crond muriendo — es el DNS interno de Docker (127.0.0.11:53) que se corrompe después de días de uptime. El container sigue corriendo, crond ejecuta puntualmente, pero rclone no puede resolver oauth2.googleapis.com para refrescar el token OAuth. Resultado: 5 días sin backups en Google Drive.

Solución Fase 1: Dokploy ejecuta `docker run --rm` del container de backup en cada schedule. Container fresco = DNS fresco = problema eliminado. Sin busybox crond, sin HEALTHCHECK, sin entrypoint complejo. El container simplemente hace backup y sale. La notificación webhook a optikt-app se mantiene igual.

Solución Fase 2: UI en /backups (solo SUPERADMIN) que usa la tabla notifications de optikt como fuente de verdad. Sin Docker API, sin socket-proxy, sin rclone en optikt-app, sin Google Drive API. El trigger manual se hace vía API de Dokploy (POST con scheduleId + API key). El status se deriva del último registro de notificación: verde si <26h, amarillo si >26h, rojo si >48h o fallo.

## Implementation
- Simplificar backup/Dockerfile: quitar entrypoint.sh, crond, bash. Cambiar CMD a backup.sh directamente. Container hace pg_dump + rclone + webhook y sale.
- Eliminar backup/entrypoint.sh (ya no se necesita scheduler interno).
- Actualizar docker-compose-prod.yml: eliminar el servicio backup completo (Dokploy lo gestiona).
- Actualizar backup/README.md con instrucciones de setup en Dokploy: crear Schedule Job, imagen, cron, env vars.
- Agregar BACKUP_FAILED a NotificationType enum. Actualizar webhook para crear BACKUP_FAILED cuando status !== success (guarda filename y error en metadata).
- Agregar getRecentBackupNotifications() al queries/notifications.ts — devuelve últimos N backups con filename, size, status, timestamp.
- Crear src/lib/remote/backups.remote.ts con listBackupHistory, runBackup (via Dokploy API), getBackupStatus. Schemas Zod. Guard requireUserAdmin().
- Crear página /backups: +page.server.ts (load inicial vía listBackupHistory), +page.svelte con header de status, botón Ejecutar ahora, tabla de historial.
- Crear componentes: BackupsTable.svelte (usa DataTable existente), BackupsStatusBadge.svelte (verde/amarillo/rojo).
- Agregar /backups a SUPER_ADMIN_ITEMS en routes.ts con icono HardDrive.
- Agregar DOKPLOY_API_URL, DOKPLOY_API_KEY, DOKPLOY_BACKUP_SCHEDULE_ID a .env.example.
- Verificar: pnpm check, pnpm lint. Probar flujo completo: trigger manual vía UI → Dokploy ejecuta → webhook notifica → UI refleja nuevo backup.

## Required Specs
<!-- SPECS_START -->
- backup-dokploy-spec
- backup-infra-sec
- public-catalog-arch
<!-- SPECS_END -->