# Spec: backup-infra-sec

Scope: repo

# Backup Infrastructure & Security Architecture

## Docker Socket Proxy (docker-compose-prod.yml)

Add a `docker-proxy` service using `tecnativa/docker-socket-proxy`:

```yaml
docker-proxy:
  image: tecnativa/docker-socket-proxy:latest
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  environment:
    CONTAINERS: 1
    EXEC: 1
    POST: 1
    # Intentionally NOT set: GET, DELETE, IMAGES, AUTH, etc.
  networks:
    - docker-proxy-net
  restart: unless-stopped

optikt-app:
  # ... existing config ...
  environment:
    DOCKER_HOST: http://docker-proxy:2375
  networks:
    - default
    - docker-proxy-net

networks:
  docker-proxy-net:
    internal: true
```

**Security constraints:**
- Socket mounted as READ-ONLY (`:ro`)
- Only POST, CONTAINERS, and EXEC permissions enabled
- Proxy on isolated `internal: true` network — unreachable from internet
- Target container name (`optikt-backup`) hardcoded on server — never from client

## Backup Container Healthcheck (backup/Dockerfile)

Add HEALTHCHECK and modify backup.sh:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep crond > /dev/null && \
      LAST_RUN=$(cat /tmp/backup-last-run 2>/dev/null || echo 0) && \
      NOW=$(date +%s) && \
      [ $((NOW - LAST_RUN)) -lt 90000 ] || exit 1
```

In `backup/backup.sh`, add after successful completion:
```bash
date +%s > /tmp/backup-last-run
```

This ensures Docker auto-restarts the container if:
- `crond` process dies
- No backup has run in the last 25 hours (90000 seconds → buffer over 24h schedule)

## Docker API Usage (src/lib/remote/backups.remote.ts)

All calls go through `DOCKER_HOST=http://docker-proxy:2375`:

### List Backups
1. POST /v1.41/containers/optikt-backup/exec → create exec with `["rclone", "lsl", "gdrive:", "--config", "/etc/rclone/rclone.conf"]`
2. POST /v1.41/exec/{id}/start → get stdout
3. Parse rclone lsl output: `{filename, sizeBytes, modifiedAt}`

### Run Backup Now
1. POST /v1.41/containers/optikt-backup/exec → create exec with `["/usr/local/bin/backup.sh"]`
2. POST /v1.41/exec/{id}/start → fire and forget (detached mode)

### Restart Container
1. POST /v1.41/containers/optikt-backup/restart

### Get Status
1. POST /v1.41/containers/optikt-backup/exec → `["pgrep", "crond"]` → returns PID or empty
2. Read /tmp/backup-last-run from container (or use a separate healthcheck endpoint)