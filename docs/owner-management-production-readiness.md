# Owner-management production readiness

Run the scripts in `scripts/production/` only on the VPS after reviewing their
environment variables. They do not use `prisma db push`, `migrate dev`, reset,
or any destructive SQL.

Required manual staging checks after the backup and SQL verification:

1. Admin login opens `/dashboard`; partner login opens `/partner`.
2. A partner opening `/dashboard` is redirected or receives `403` for admin APIs.
3. Partner A cannot request a Partner B page, expense, revenue, or statement.
4. Upload a JPG/PNG/WEBP invoice from a phone; review OCR date/amount before save.
5. Upload the approved NBK PDF, verify Preview causes no inserts, then Confirm.
6. Verify Confirm writes only `MATCHED` records and a second upload is rejected as duplicate.
7. Verify revenue dates and totals in admin revenues, partner revenues, and partner statement.

Rollback: stop the deployment, restore the backup created by
`backup-before-owner-management.sh` to a maintenance database first, validate it,
then restore only under an approved incident procedure. Application rollback is a
fast-forward-safe checkout of the prior release followed by `npm ci`, `prisma generate`,
`npm run build`, and `pm2 restart arasgroup --update-env`. Do not run rollback SQL
automatically.
