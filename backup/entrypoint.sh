#!/usr/bin/env bash
set -euo pipefail

CRON_SCHEDULE="${BACKUP_CRON:-0 2 * * *}"

# Validate exactly 5 fields
field_count=$(echo "$CRON_SCHEDULE" | awk '{print NF}')
if [ "$field_count" -ne 5 ]; then
  echo "ERROR: BACKUP_CRON must have exactly 5 cron fields (got: '${CRON_SCHEDULE}')"
  exit 1
fi

echo "==========================================="
echo "  Optikt DB Backup Scheduler"
echo "  Schedule : ${CRON_SCHEDULE}"
echo "  Timezone : ${TZ:-UTC}"
echo "==========================================="

# Write crontab for root
echo "${CRON_SCHEDULE} /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" | crontab -

# Start crond in foreground (busybox crond)
exec crond -f -l 2
