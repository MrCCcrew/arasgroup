#!/usr/bin/env bash
set -euo pipefail

# Review this script on the VPS before executing it. It deliberately performs no db push/migrate dev.
: "${APP_DIR:?APP_DIR is required}" "${DB_HOST:?DB_HOST is required}" "${DB_PORT:=3306}" "${DB_NAME:?DB_NAME is required}" "${DB_USER:?DB_USER is required}" "${MYSQL_PWD:?MYSQL_PWD is required}" "${APP_URL:?APP_URL is required}"
[[ "$DB_NAME" == "rashidgroup_db" ]] || { echo "Refusing unexpected database: $DB_NAME" >&2; exit 1; }
cd "$APP_DIR"

git fetch origin
git pull --ff-only origin main
npm ci
npx prisma generate

backup_file="$(bash scripts/production/backup-before-owner-management.sh)"
[[ -s "$backup_file" ]] || { echo "Backup verification failed" >&2; exit 1; }
mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" < prisma/migrations/20260727_owner_management_production/migration.sql
npm run build
pm2 restart arasgroup --update-env
bash scripts/production/verify-owner-management.sh
