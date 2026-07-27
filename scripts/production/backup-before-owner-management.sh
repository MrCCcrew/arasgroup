#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS. Supply DB_HOST, DB_PORT, DB_NAME, DB_USER and MYSQL_PWD through
# the process environment; do not place credentials in this script or the repository.
: "${DB_HOST:?DB_HOST is required}" "${DB_PORT:=3306}" "${DB_NAME:?DB_NAME is required}" "${DB_USER:?DB_USER is required}" "${MYSQL_PWD:?MYSQL_PWD is required}"
[[ "$DB_NAME" == "rashidgroup_db" ]] || { echo "Refusing unexpected database: $DB_NAME" >&2; exit 1; }

backup_dir="${BACKUP_DIR:-/var/backups/arasgroup}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_dir/${DB_NAME}-before-owner-management-${stamp}.sql.gz"

mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --single-transaction --routines --events --triggers --hex-blob --default-character-set=utf8mb4 "$DB_NAME" | gzip -9 > "$target"
[[ -s "$target" && $(stat -c%s "$target") -gt 1024 ]] || { rm -f "$target"; echo "Backup is missing or too small" >&2; exit 1; }
gzip -t "$target"
sha256sum "$target" > "${target}.sha256"
echo "$target"
