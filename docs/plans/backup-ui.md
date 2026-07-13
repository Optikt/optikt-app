---
plan name: backup-ui
plan description: Backup management UI and reliability
plan status: active
---

## Idea
The backup container (optikt-backup) silently stops working over time — busybox crond is unreliable. We need to:
1. Fix reliability: Add Docker HEALTHCHECK to auto-restart the container if cron dies, and add a last-run timestamp file so we can detect stale backups.
2. Add docker-socket-proxy (tecnativa/docker-socket-proxy) as a secure middleman so the app can restart the backup container and exec commands without mounting docker.sock directly.
3. Create remote server functions (listBackups, runBackup, restartBackup, getBackupStatus) that use the Docker API via the proxy.
4. Create a super admin page at /backups with: table of backups from Google Drive (via rclone lsl), "Run backup now" button, "Restart service" button, status indicator (last backup time, cron alive).
5. Integrate with existing app patterns: remote functions in src/lib/remote/, guard with requireUserAdmin(), sidebar entry in SUPER_ADMIN_ITEMS.

The docker-socket-proxy is configured with minimum permissions: CONTAINERS=1, EXEC=1, POST=1 only — no GET, no DELETE, no other API access. The proxy lives on an isolated internal network. The target container name is hardcoded on the server — never accepted from the client.

## Implementation
- Add docker-socket-proxy service to docker-compose-prod.yml with restricted permissions (CONTAINERS=1, EXEC=1, POST=1) on isolated internal network, and inject DOCKER_HOST into optikt-app
- Update backup/Dockerfile with HEALTHCHECK (pgrep crond) and modify backup.sh to write a last-run timestamp file for health monitoring
- Create src/lib/remote/backups.remote.ts with command() exports: listBackups (exec rclone lsl), runBackup (exec backup.sh), restartBackup (POST /containers/restart), getBackupStatus (exec pgrep + timestamp check)
- Create src/routes/(app)/backups/+page.server.ts with SSR load function (optional initial data, auth guard) and +page.svelte with backup table, action buttons, and status indicator
- Create src/lib/components/backups/BackupsTable.svelte using existing DataTable pattern, and BackupsActions.svelte with Run now / Restart / Refresh buttons with loading states
- Add /backups to SUPER_ADMIN_ITEMS in src/lib/shared/routes.ts and add the icon resource
- Add deploy documentation for new env vars (DOCKER_HOST, docker-proxy setup) to backup/README.md

## Required Specs
<!-- SPECS_START -->
- backup-infra-sec
- backup-ui-ux
<!-- SPECS_END -->