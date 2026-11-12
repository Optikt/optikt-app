#!/usr/bin/env bash
# DEV ONLY - never runs in production
#
# Restaura la DB de DESARROLLO (Supabase) desde un dump plano de prod:
#   1) dropea los schemas que administra la app (public + drizzle; NO toca
#      auth/storage/extensions de Supabase),
#   2) restaura el dump,
#   3) verifica el estado (incluye el guard de journal antes de migrar),
#   4) opcionalmente (-migrate) corre `pnpm db:migrate`.
#
# ⚠️ DESTRUCTIVO: la data dev actual se reemplaza por la del dump.
set -euo pipefail

trap 'unset DB_URL' EXIT

usage() {
	cat <<'EOF'
Usage: bash dev/restore-dev.sh <dump.sql[.gz]> --url <DATABASE_URL> [--migrate] [--yes]

  <dump.sql[.gz]>     dump plano de PostgreSQL (pg_dump), comprimido con gzip o no
  --url               conexión explícita a la DB de DEV (postgresql://...)
  --migrate           además corre `pnpm db:migrate` (por defecto NO se corre)
  --yes               no pedir confirmación (solo para uso no interactivo)
  -h, --help          esta ayuda

Ejemplo:
  bash dev/restore-dev.sh ~/Downloads/optikt-backup-2026-11-11_225758.sql.gz \
    --url "$DATABASE_URL" --migrate
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
	psql --quiet --set=ON_ERROR_STOP=on --no-password --dbname "$DB_URL" "$@"
}

BACKUP_FILE=""
DB_URL=""
DO_MIGRATE=false
ASSUME_YES=false

while [[ $# -gt 0 ]]; do
	case "$1" in
		--url)
			require_value "$1" "${2:-}"
			DB_URL="$2"
			shift 2
			;;
		--url=*)
			DB_URL="${1#*=}"
			require_value "--url" "$DB_URL"
			shift
			;;
		--migrate)
			DO_MIGRATE=true
			shift
			;;
		--yes)
			ASSUME_YES=true
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
	die "Dump file path is required"
}
[[ -n "$DB_URL" ]] || {
	usage
	die "--url <DATABASE_URL> is required (passed explicitly, never read from .env)"
}
[[ "$DB_URL" == postgresql://* || "$DB_URL" == postgres://* ]] ||
	die "--url must be a postgresql:// connection string"
[[ "$BACKUP_FILE" == *.sql.gz || "$BACKUP_FILE" == *.sql ]] ||
	die "Backup file must end in .sql or .sql.gz: $BACKUP_FILE"
[[ -f "$BACKUP_FILE" ]] || die "Backup file does not exist: $BACKUP_FILE"
command -v psql >/dev/null 2>&1 || die "psql is not installed or not available on PATH"
command -v pnpm >/dev/null 2>&1 || die "pnpm is not installed or not available on PATH"
[[ "$BACKUP_FILE" != *.sql.gz ]] || command -v gunzip >/dev/null 2>&1 ||
	die "gunzip is not installed or not available on PATH"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

MASKED_URL="$(printf '%s' "$DB_URL" | sed -E 's#//([^:/]+):[^@]+@#//\1:***@#')"
echo "→ Dump:   $BACKUP_FILE"
echo "→ Target: $MASKED_URL"

if [[ "$ASSUME_YES" == false ]]; then
	[[ -t 0 ]] || die "Non-interactive mode: pass --yes to confirm the drop"
	read -r -p "This DROPS schemas 'public' and 'drizzle' on the target (irreversible, replaces all dev data). Type 'yes' to continue: " CONFIRM
	[[ "$CONFIRM" == "yes" ]] || die "Aborted"
fi

echo "→ Dropping schemas 'public' and 'drizzle'..."
run_psql <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
DROP SCHEMA drizzle CASCADE;
SQL

echo "→ Restoring backup from '$BACKUP_FILE'..."
if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
	gunzip -c "$BACKUP_FILE" | run_psql || die "psql failed while restoring ${BACKUP_FILE}; check file format and SQL syntax"
else
	run_psql --file "$BACKUP_FILE" || die "psql failed while restoring ${BACKUP_FILE}; check file format and SQL syntax"
fi

echo "→ Verifying restored state..."
run_psql --tuples-only --command \
	"SELECT '  tables(public)=' || count(*) FROM information_schema.tables WHERE table_schema = 'public';"
run_psql --tuples-only --command \
	"SELECT '  migrations=' || count(*) || ' · max(created_at)=' || max(created_at) FROM drizzle.__drizzle_migrations;"

JOURNAL_TABLES="$(run_psql --tuples-only --command \
	"SELECT count(*) FROM information_schema.tables WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations';" | tr -d '[:space:]')"
if [[ "$JOURNAL_TABLES" != "1" ]]; then
	die "The dump has no drizzle.__drizzle_migrations: the journal is incomplete — do NOT run db:migrate with it (it would try to re-apply everything)"
fi

if [[ "$DO_MIGRATE" == true ]]; then
	echo "→ Running pnpm db:migrate..."
	pnpm db:migrate
else
	echo "→ Skipping migrations (pass --migrate to apply pending ones)"
fi

echo "✓ Done"
