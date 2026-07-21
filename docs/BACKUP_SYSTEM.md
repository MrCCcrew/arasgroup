# نظام النسخ الاحتياطي الآمن

## نظرة عامة

نظام النسخ الاحتياطي تم تصميمه ليكون:
- ✅ **آمن**: يعمل خارج Next.js، لا يستهلك ذاكرة التطبيق
- ✅ **موثوق**: يستخدم mysqldump الأصلي
- ✅ **تلقائي**: يعمل يومياً عبر Linux cron
- ✅ **Read-Only**: التطبيق يعرض النسخ فقط، لا ينشئها

---

## البنية

### 1. النسخ الاحتياطي (على السيرفر)

**الموقع:**
```
/opt/arasgroup-backup/backup.sh
```

**الجدولة:**
- Linux cron يومياً الساعة 3:00 صباحاً
- يستخدم mysqldump
- بيانات MySQL في: `/root/.arasgroup-my.cnf`

**مجلد التخزين:**
```
/var/backups/arasgroup/database/
```

**نمط الأسماء:**
```
rashidgroup_db_YYYY-MM-DD_HH-MM-SS.sql.gz
```

**مثال:**
```
rashidgroup_db_2026-07-22_03-00-00.sql.gz
```

---

### 2. الواجهة (Next.js - Read-Only)

**الصفحة:**
```
/dashboard/settings → DatabaseBackup component
```

**الوظائف:**
- ✅ عرض قائمة النسخ المتاحة
- ✅ عرض إحصائيات (عدد النسخ، الحجم، آخر نسخة)
- ✅ تحميل نسخة محددة
- ❌ لا تنشئ نسخ
- ❌ لا تنفذ استعادة

**API Endpoints:**

| Endpoint | Method | الوظيفة | الصلاحية |
|----------|--------|----------|----------|
| `/api/admin/backups/list` | GET | قائمة النسخ | Super Admin |
| `/api/admin/backups/[filename]/download` | GET | تحميل نسخة | Super Admin |
| `/api/admin/backups/restore-request` | POST | طلب استعادة (تسجيل فقط) | Super Admin |

---

## الحماية الأمنية

### 1. Path Traversal Protection

✅ **Validation:**
- اسم الملف يجب أن يطابق: `^rashidgroup_db_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql\.gz$`
- لا يحتوي على: `/`, `\`, `..`, null bytes
- basename مطابق للاسم الأصلي

✅ **Resolution:**
```typescript
const resolved = path.resolve(backupDir, filename);
const relative = path.relative(backupDir, resolved);
// يجب ألا يبدأ بـ .. أو يكون absolute
```

✅ **Symlink Protection:**
```typescript
const stats = fs.lstatSync(fullPath);
if (stats.isSymbolicLink()) throw Error();
```

### 2. Authorization

✅ **كل endpoint يتحقق من:**
```typescript
const session = await getSession();
if (!session?.isSuperAdmin) {
  return 403;
}
```

### 3. Streaming Downloads

✅ **لا تحميل كامل في الذاكرة:**
```typescript
const fileStream = fs.createReadStream(fullPath);
const webStream = Readable.toWeb(fileStream);
return new NextResponse(webStream);
```

---

## الاستعادة (Restore)

### ⚠️ مهم جداً

**الاستعادة لا تتم من التطبيق!**

الواجهة تسجل طلب الاستعادة فقط في AuditLog:
```typescript
action: "BACKUP_RESTORE_REQUESTED"
status: "pending_manual_restore"
```

### خطوات الاستعادة الآمنة (يدوياً على السيرفر)

**1. نسخة احتياطية إضافية:**
```bash
ssh root@arasgroup.app
mysqldump --defaults-file=/root/.arasgroup-my.cnf rashidgroup_db > pre-restore-backup.sql
```

**2. إيقاف التطبيق:**
```bash
pm2 stop arasgroup
```

**3. استعادة النسخة:**
```bash
cd /var/backups/arasgroup/database
gunzip -c rashidgroup_db_2026-07-22_03-00-00.sql.gz | mysql --defaults-file=/root/.arasgroup-my.cnf rashidgroup_db
```

**4. التحقق:**
```bash
mysql --defaults-file=/root/.arasgroup-my.cnf rashidgroup_db -e "SHOW TABLES;"
```

**5. إعادة التشغيل:**
```bash
pm2 start arasgroup
```

---

## الملفات الهامة

### Server-Side Utilities
```
lib/backup/server-backups.ts
```
- `getBackupDirectory()`
- `validateBackupFilename()`
- `resolveBackupPath()`
- `listBackupFiles()`
- `getBackupStats()`

### Types
```
types/backup.ts
```

### API Routes
```
app/api/admin/backups/list/route.ts
app/api/admin/backups/[filename]/download/route.ts
app/api/admin/backups/restore-request/route.ts
```

### Component
```
components/settings/database-backup.tsx
```

---

## Environment Variables

```env
# اختياري - يتجاوز المسار الافتراضي
ARASGROUP_BACKUP_DIR=/var/backups/arasgroup/database
```

**القيمة الافتراضية:**
```
/var/backups/arasgroup/database
```

**في Development:**
- إذا المجلد غير موجود → قائمة فارغة + رسالة
- لا يفشل Build

---

## ما تم حذفه/تعطيله

| الملف | الحالة | السبب |
|------|--------|-------|
| `lib/backup/sql-generator.ts` | ✅ محذوف | كان يقرأ كل القاعدة في الذاكرة - خطير |
| `app/api/cron/daily-backup/route.ts` | ⚠️ معطل (410 Gone) | استبدل بـ Linux cron خارجي |
| `app/api/admin/backup/auto/route.ts` | ⚠️ معطل (410 Gone) | استبدل بنظام جديد |
| `app/api/admin/backup/export/route.ts` | ⚠️ معطل (410 Gone) | استبدل بنظام جديد |
| `docs/BACKUP_SETUP.md` | ✅ محذوف | معلومات قديمة وخطأ Port 3000 |

**ملاحظة:** CRON_SECRET لم يُحذف من `.env` لأن `/api/push/dispatch` يستخدمه.

---

## Audit Log

طلبات الاستعادة تُسجل في `audit_logs`:

```json
{
  "action": "BACKUP_RESTORE_REQUESTED",
  "module": "BACKUP",
  "resourceType": "BackupFile",
  "resourceId": "rashidgroup_db_2026-07-22_03-00-00.sql.gz",
  "newValues": {
    "backupFilename": "...",
    "confirmationPhrase": "RESTORE RASHIDGROUP",
    "status": "pending_manual_restore",
    "requestedBy": "userId",
    "requestedByEmail": "user@example.com"
  }
}
```

---

## الأمان

✅ **ما تم تطبيقه:**
- Path traversal protection
- Filename whitelist (regex)
- Symlink blocking
- Authorization (Super Admin only)
- Streaming downloads (no memory overflow)
- No shell commands from web
- No SQL execution from web
- Audit logging

❌ **ما لم يتم:**
- Restore تنفيذي (متعمد - للأمان)
- نسخ احتياطي من Next.js (متعمد - يعمل خارجياً)
- gzip verification (يتم يدوياً)

---

## الاختبارات

الاختبارات تستخدم temporary directory وليس production path.

**يجب اختبار:**
- ✅ Valid filename accepted
- ✅ Path traversal rejected
- ✅ Symlink rejected
- ✅ Unauthorized rejected
- ✅ Non-super-admin rejected
- ✅ Download streams correctly
- ✅ Path not exposed in errors
- ✅ Restore request logs to audit only
- ✅ No SQL execution during restore request

---

## Port Configuration

⚠️ **مهم:**
- ArasGroup يعمل على **Port 3001**
- FitZone يعمل على Port 3000
- لا تغيير في PM2 أو Nginx أو Ports

---

## المراجع

- Server-side backup script: `/opt/arasgroup-backup/backup.sh`
- MySQL credentials: `/root/.arasgroup-my.cnf` (لا تُقرأ من Next.js)
- Backup directory: `/var/backups/arasgroup/database/`
- Cron schedule: يومياً 3:00 صباحاً

