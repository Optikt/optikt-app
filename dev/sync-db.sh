#!/usr/bin/env bash
# DEV ONLY - never runs in production
set -euo pipefail

DB_NAME="optikt_db"
DB_USER="optikt"
DB_HOST="localhost"
DB_PASSWORD=""
PASSWORD_PROVIDED=false
BACKUP_FILE=""

trap 'unset DB_PASSWORD PGPASSWORD' EXIT

usage() {
	cat <<'EOF'
Usage: bash dev/sync-db.sh <backup.sql> [--db-name name] [--db-user user] [--db-host host] [--db-password password]
EOF
}

die() {
	echo "✗ $1" >&2
	exit 1
}

require_value() {
	local flag="$1"
	local value="${2:-}"

	[[ -n "$value" ]] || die "Missing value for $flag"
}

run_psql() {
	PGPASSWORD="$DB_PASSWORD" psql --quiet --set=ON_ERROR_STOP=on --no-password "$@"
}

while [[ $# -gt 0 ]]; do
	case "$1" in
		--db-name)
			require_value "$1" "${2:-}"
			DB_NAME="$2"
			shift 2
			;;
		--db-name=*)
			DB_NAME="${1#*=}"
			require_value "--db-name" "$DB_NAME"
			shift
			;;
		--db-user)
			require_value "$1" "${2:-}"
			DB_USER="$2"
			shift 2
			;;
		--db-user=*)
			DB_USER="${1#*=}"
			require_value "--db-user" "$DB_USER"
			shift
			;;
		--db-host)
			require_value "$1" "${2:-}"
			DB_HOST="$2"
			shift 2
			;;
		--db-host=*)
			DB_HOST="${1#*=}"
			require_value "--db-host" "$DB_HOST"
			shift
			;;
		--db-password)
			require_value "$1" "${2:-}"
			DB_PASSWORD="$2"
			PASSWORD_PROVIDED=true
			shift 2
			;;
		--db-password=*)
			DB_PASSWORD="${1#*=}"
			require_value "--db-password" "$DB_PASSWORD"
			PASSWORD_PROVIDED=true
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		-*)
			die "Unknown option: $1"
			;;
		*)
			[[ -z "$BACKUP_FILE" ]] || die "Unexpected argument: $1"
			BACKUP_FILE="$1"
			shift
			;;
	esac
done

[[ -n "$BACKUP_FILE" ]] || {
	usage
	die "Backup file path is required"
}

[[ -f "$BACKUP_FILE" ]] || die "Backup file does not exist: $BACKUP_FILE"
command -v psql >/dev/null 2>&1 || die "psql is not installed or not available on PATH"

if [[ "$PASSWORD_PROVIDED" == false ]]; then
	[[ -t 0 ]] || die "Database password is required in non-interactive mode; pass --db-password"
	if ! read -r -s -p "Database password: " DB_PASSWORD; then
		echo
		die "Database password prompt failed; pass --db-password to run non-interactively"
	fi
	echo
fi

echo "→ Dropping database '$DB_NAME'..."
if ! run_psql --host "$DB_HOST" --username "$DB_USER" --dbname postgres "--set=db_name=$DB_NAME" <<'SQL'
SET app.sync_db_name = :'db_name';
DO $$
BEGIN
	PERFORM pg_terminate_backend(pid)
	FROM pg_stat_activity
	WHERE datname = current_setting('app.sync_db_name')
		AND pid <> pg_backend_pid();
END
$$;
DROP DATABASE IF EXISTS :"db_name";
SQL
then
	die "psql failed while dropping database ${DB_NAME}"
fi

echo "→ Creating database '$DB_NAME'..."
if ! run_psql --host "$DB_HOST" --username "$DB_USER" --dbname postgres "--set=db_name=$DB_NAME" "--set=db_user=$DB_USER" <<'SQL'
CREATE DATABASE :"db_name" OWNER :"db_user";
SQL
then
	die "psql failed while creating database ${DB_NAME}"
fi

echo "→ Restoring backup from '$BACKUP_FILE'..."
if ! run_psql --host "$DB_HOST" --username "$DB_USER" --dbname "$DB_NAME" --file "$BACKUP_FILE"; then
	die "psql failed while restoring backup ${BACKUP_FILE}"
fi

echo "✓ Done"
