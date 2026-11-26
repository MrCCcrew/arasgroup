# Delivery hourly work

Contracts can enable hourly work and define a default company receivable rate in KWD. The existing daily-order and restaurant/location workflows remain available for mixed contracts.

From **Contracts → Hours & work entities**, add actual work entities (for example, eyed under RoPops). An entity may override the contract hourly rate. Record a driver's date, entity, hours and minutes, order count and optional rate override. A driver may work for multiple entities on the same day.

Amounts use decimal arithmetic: minutes × hourly rate ÷ 60, rounded half up to 3 decimals. Order counts are operational statistics only. Stored rates and amounts do not change when contract/entity defaults change. Monthly filters cover driver and entity, and aggregates cover all matching records, including records on other pages. These operational amounts do not automatically create journal entries, invoices or payroll payments.

Only one record is allowed per driver/contract/entity/date. Edit that record to correct its hours or orders. Driver-row locking prevents concurrent records from exceeding 24 total hours on a date across all contracts. All writes check company permissions and branch access; entities and drivers are validated against the contract/company. Mutations are audited. Entities can be deactivated while keeping their historical work records.

## Deployment

This feature requires the additive SQL migration at `prisma/migrations/20260920_delivery_hourly_work/migration.sql` before starting the new application build. Back up the database, apply this migration once using the existing production migration procedure, regenerate Prisma Client, build and activate the application. The migration does not change existing contract settings, rates, orders or financial records. Existing contracts default to hourly work disabled.

Do not use `db push`, reset the database or apply unrelated historical migrations for this change. If application rollback is needed, restore the previous application build; keep the additive tables and columns so entered hours are preserved.

## Validation

- `npm run typecheck:app`
- `npm run test:delivery-hourly`
- `npm run test:delivery-hourly:integration` after applying the migration to `rashidgroup_test`. The test refuses other database names, uses temporary contracts and cleans up its own records.

Integration coverage includes rate snapshots, order counts independent of amounts, multiple entities, CRUD, monthly totals, entity filtering, contract boundaries, access denial, uniqueness, concurrent daily limits and audit logging.
