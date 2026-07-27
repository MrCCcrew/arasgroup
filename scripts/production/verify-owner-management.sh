#!/usr/bin/env bash
set -euo pipefail

: "${DB_HOST:?DB_HOST is required}" "${DB_PORT:=3306}" "${DB_NAME:?DB_NAME is required}" "${DB_USER:?DB_USER is required}" "${MYSQL_PWD:?MYSQL_PWD is required}"
[[ "$DB_NAME" == "rashidgroup_db" ]] || { echo "Refusing unexpected database: $DB_NAME" >&2; exit 1; }

mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" -N -e "
SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('owner_managed_partners','owner_managed_expenses','owner_managed_statement_imports','owner_managed_revenues') ORDER BY table_name;
SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'owner_managed_revenues' AND column_name IN ('transactionDate','postingDate','transactionReference','status') ORDER BY column_name;"

curl --fail --silent --show-error "${APP_URL:?APP_URL is required}/login" >/dev/null
pm2 status arasgroup
pm2 logs arasgroup --lines 50 --nostream
