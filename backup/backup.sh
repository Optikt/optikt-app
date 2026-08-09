#!/usr/bin/env bash
set -uo pipefail

STATUS="success"
ERROR_MSG=""
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
FILENAME="optikt-backup-${TIMESTAMP}.sql.gz"
BACKUP_FILE="/backups/${FILENAME}"

echo ""
echo "=== Backup started at $(date) ==="

# 1. pg_dump → gzip
echo "[1/4] Running pg_dump..."
if PGPASSWORD="${PG_PASSWORD}" pg_dump \
  -h "${PG_HOST:-postgres}" \
  -p "${PG_PORT:-5432}" \
  -U "${PG_USER}" \
  -d "${PG_DB}" \
  --no-owner \
  --no-privileges \
  -F plain \
  | gzip > "${BACKUP_FILE}"; then
  BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
  echo "      Saved: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
  echo "      ERROR: pg_dump failed!"
  STATUS="error"
  ERROR_MSG="pg_dump failed"
fi

# 2. Upload to Google Drive
echo "[2/4] Uploading to Google Drive..."
if [ -f "${BACKUP_FILE}" ]; then
  if rclone copyto "${BACKUP_FILE}" \
    "${DRIVE_REMOTE:-gdrive}:${FILENAME}" \
    --config /etc/rclone/rclone.conf; then
    echo "      Uploaded: ${FILENAME}"
  else
    echo "      ERROR: Upload failed!"
    STATUS="error"
    ERROR_MSG="rclone upload failed (DNS/network/credentials)"
  fi
else
  echo "      SKIP: No backup file to upload."
  STATUS="error"
  ERROR_MSG="no backup file produced"
fi

# 3. Retention policy — remove files older than N days
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
echo "[3/4] Enforcing retention (${RETENTION} days)..."
rclone delete \
  "${DRIVE_REMOTE:-gdrive}:" \
  --min-age "${RETENTION}d" \
  --config /etc/rclone/rclone.conf \
  && echo "      Old backups removed." \
  || echo "      WARN: Retention cleanup failed (non-critical)."

# 4. Remove local copy
echo "[4/4] Cleaning up local file..."
rm -f "${BACKUP_FILE}" && echo "      Local file removed."

# 5. Optional webhook notification (non-critical — failures are ignored)
if [ -n "${NOTIFY_URL:-}" ]; then
  echo "[5/5] Sending notification to ${NOTIFY_URL}..."
  curl -sf -X POST "${NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NOTIFY_TOKEN:-}" \
    -d "{\"status\":\"${STATUS}\",\"filename\":\"${FILENAME}\",\"size\":\"${BACKUP_SIZE:-unknown}\",\"error\":\"${ERROR_MSG}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    || true
  echo "      Notification sent."
fi

echo "=== Backup ${STATUS} at $(date) ==="
exit $([ "$STATUS" = "success" ] && echo 0 || echo 1)
