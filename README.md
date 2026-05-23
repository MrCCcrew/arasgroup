# نظام مجموعة رشيد — Rashid Group ERP

Arabic RTL ERP system for Abdul Fattah Rashid Suleiman Group (Kuwait).  
Built with Next.js 15, Prisma 6, MySQL 8, TypeScript, Tailwind CSS.

---

## MySQL Setup

### Option A — Docker (recommended for development)

```bash
docker run -d \
  --name rashid-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=rashid_group_erp \
  -e MYSQL_CHARACTER_SET_SERVER=utf8mb4 \
  -e MYSQL_COLLATION_SERVER=utf8mb4_unicode_ci \
  -p 3306:3306 \
  mysql:8.0
```

Wait ~15 seconds for MySQL to initialise, then verify:

```bash
docker exec -it rashid-mysql mysql -uroot -ppassword -e "SHOW DATABASES;"
```

### Option B — Local MySQL 8

Create the database and set the collation:

```sql
CREATE DATABASE rashid_group_erp
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables:

| Variable | Example |
|---|---|
| `DATABASE_URL` | `mysql://root:password@localhost:3306/rashid_group_erp` |
| `JWT_SECRET` | any 32+ character random string |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

---

## Getting Started

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to MySQL (development)
npm run db:push

# Seed initial data (roles, companies, chart of accounts, admin user)
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Default credentials

| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@rashidgroup.kw` | `Admin@2025!` |
| Accountant | `accountant@rashidgroup.kw` | `Accountant@2025!` |

---

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB (no migration history) |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset DB and re-seed (destructive) |

---

## Architecture

- **Framework**: Next.js 15 App Router (server components + API routes)
- **Database**: MySQL 8 via Prisma 6
- **Auth**: Custom JWT with `jose` (no NextAuth), company-level RBAC
- **Accounting**: Double-entry, all amounts in KWD (3 decimal places, `DECIMAL(18,3)`)
- **Offline**: Dexie.js (IndexedDB) + service worker sync queue
- **UI**: Radix UI + Tailwind CSS, Arabic RTL (`dir="rtl"`)

### Companies

| ID | Name | Type |
|---|---|---|
| `co-it-delivery` | شركة IT للتوصيل | IT_DELIVERY |
| `co-eagle-delivery` | شركة Eagle للتوصيل | EAGLE_DELIVERY |
| `co-bergen-carwash` | Bergen لغسيل السيارات | BERGEN_CAR_WASH |
| `co-silver-valley` | Silver Valley للتجارة العامة | SILVER_VALLEY_TRADING |
| `co-bergen-trading` | Bergen للتجارة العامة | BERGEN_TRADING |

### RBAC Roles

`SUPER_ADMIN` · `GROUP_OWNER` · `ACCOUNTANT` · `DELIVERY_USER` · `CAR_WASH_SUPERVISOR` · `HR_MANDOUB` · `INVESTOR_VIEWER`

---

## MySQL-specific Notes

- **Collation**: `utf8mb4_unicode_ci` — Arabic text sorts and compares correctly; search queries are case-insensitive by default (no `mode: "insensitive"` needed in Prisma).
- **JSON columns**: `AuditLog.oldValues/newValues`, `SyncQueue.payload`, `OfflineTransaction.data` — require MySQL 5.7.8+.
- **Nullable unique index**: `UserRole(userId, roleId, companyId)` — MySQL treats NULL ≠ NULL in unique indexes, so multiple rows with `companyId = NULL` are allowed. The seed uses `findFirst` + `create` instead of `upsert` to remain idempotent.
- **`onDelete: Restrict`**: All relations to financial models (Company, BankAccount, ChartOfAccount, JournalEntry, Employee, Driver, Investor, Branch, Vehicle, CostCenter) use `Restrict` to prevent accidental deletion of records with financial history.
