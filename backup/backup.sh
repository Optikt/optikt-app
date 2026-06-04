#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
FILENAME="optikt-backup-${TIMESTAMP}.sql.gz"
BACKUP_FILE="/backups/${FILENAME}"

echo ""
echo "=== Backup started at $(date) ==="

# 1. pg_dump → gzip
echo "[1/4] Running pg_dump..."
PGPASSWORD="${PG_PASSWORD}" pg_dump \
  -h "${PG_HOST:-postgres}" \
  -p "${PG_PORT:-5432}" \
  -U "${PG_USER}" \
  -d "${PG_DB}" \
  --no-owner \
  --no-privileges \
  -F plain \
  | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "      Saved: ${BACKUP_FILE} (${BACKUP_SIZE})"

# 2. Upload to Google Drive
echo "[2/4] Uploading to Google Drive..."
rclone copyto "${BACKUP_FILE}" \
  "${DRIVE_REMOTE:-gdrive}:${GOOGLE_DRIVE_BACKUP_FOLDER_ID}/${FILENAME}" \
  --config /etc/rclone/rclone.conf
echo "      Uploaded: ${FILENAME}"

# 3. Retention policy — remove files older than N days
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
echo "[3/4] Enforcing retention (${RETENTION} days)..."
rclone delete \
  "${DRIVE_REMOTE:-gdrive}:${GOOGLE_DRIVE_BACKUP_FOLDER_ID}" \
  --min-age "${RETENTION}d" \
  --config /etc/rclone/rclone.conf
echo "      Old backups removed."

# 4. Remove local copy
echo "[4/4] Cleaning up local file..."
rm -f "${BACKUP_FILE}"
echo "      Local file removed."

# 5. Optional webhook notification (non-critical — failures are ignored)
if [ -n "${NOTIFY_URL:-}" ]; then
  echo "[5/5] Sending notification to ${NOTIFY_URL}..."
  curl -sf -X POST "${NOTIFY_URL}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${NOTIFY_TOKEN:-}" \
    -d "{\"status\":\"success\",\"filename\":\"${FILENAME}\",\"size\":\"${BACKUP_SIZE}\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" \
    || true
  echo "      Notification sent."
fi

echo "=== Backup completed at $(date) ==="
