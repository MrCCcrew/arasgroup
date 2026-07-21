# إعداد النسخ الاحتياطي الأوتوماتيكي

## نظرة عامة

النظام يوفر 3 طرق للنسخ الاحتياطي:

1. ✅ **نسخة يدوية** - تحميل SQL إلى جهازك (عبر الواجهة)
2. ✅ **نسخة سحابية** - رفع SQL إلى Cloudflare R2 (عبر الواجهة)
3. ✅ **نسخة يومية تلقائية** - cron job يرفع يومياً إلى R2

---

## إعداد النسخ الاحتياطي اليومي على السيرفر

### المتطلبات
- السيرفر: `arasgroup.app`
- PM2 مثبت وشغال
- المتغيرات البيئية للـ R2 موجودة في `.env`

### خطوات الإعداد

#### 1. توليد CRON_SECRET عشوائي

**على Windows PowerShell:**

```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**على Linux/Mac:**

```bash
openssl rand -base64 32
```

**مثال على النتيجة:** `FNMWQ0rxncCuZviGDOkIhX2Rj6JLH1mo`

**احفظ هذا الرمز!** ستحتاجه في الخطوتين التاليتين.

#### 2. إضافة CRON_SECRET في `.env` على السيرفر

```bash
ssh root@arasgroup.app
cd /var/www/arasgroup.app
nano .env
```

أضف السطر التالي (استبدل بالرمز الذي ولدته):
```env
CRON_SECRET=FNMWQ0rxncCuZviGDOkIhX2Rj6JLH1mo
```

احفظ واخرج (Ctrl+X ثم Y ثم Enter)

#### 3. إعادة تشغيل PM2 لتحميل المتغير الجديد

```bash
pm2 reload arasgroup --update-env
```

#### 4. إضافة Cron Job

```bash
crontab -e
```

أضف السطر التالي (يشتغل كل يوم الساعة 2:00 صباحاً بتوقيت السيرفر):

**خيار 1 (الأسهل والأضمن) - استخدام الدومين:**

```cron
0 2 * * * curl -H "Authorization: Bearer MrCCcrew1985_1986" https://arasgroup.app/api/cron/daily-backup >> /var/log/backup-cron.log 2>&1
```

**خيار 2 (أسرع) - استخدام localhost:**

```cron
0 2 * * * curl -H "Authorization: Bearer MrCCcrew1985_1986" http://localhost:3000/api/cron/daily-backup >> /var/log/backup-cron.log 2>&1
```

**ملاحظة:** إذا التطبيق على بورت غير 3000، غيّر البورت في الأمر

احفظ واخرج

#### 5. التحقق من Cron Jobs

```bash
crontab -l
```

يجب أن ترى السطر المضاف

#### 6. اختبار يدوياً

**عبر الدومين (مضمون):**

```bash
curl -H "Authorization: Bearer MrCCcrew1985_1986" https://arasgroup.app/api/cron/daily-backup
```

**أو عبر localhost (أسرع):**

```bash
curl -H "Authorization: Bearer MrCCcrew1985_1986" http://localhost:3000/api/cron/daily-backup
```

يجب أن ترى:
```json
{
  "success": true,
  "message": "Daily backup completed successfully",
  "filename": "backups/daily/2026-07-21.sql",
  "url": "https://pub-...",
  "size": 123456,
  "timestamp": "2026-07-21T02:00:00.000Z"
}
```

#### 7. مراقبة الـ logs

```bash
tail -f /var/log/backup-cron.log
```

---

## مواقع النسخ الاحتياطية

### على Cloudflare R2:

- **النسخ اليومية التلقائية:** `backups/daily/YYYY-MM-DD.sql`
- **النسخ اليدوية:** `backups/auto_YYYY-MM-DD-HHMMSS.sql`

### الوصول للنسخ:

يمكنك تحميل النسخ من R2 عبر:
- Cloudflare Dashboard: https://dash.cloudflare.com
- أو استخدام AWS CLI مع R2 endpoint

---

## استعادة نسخة احتياطية (يدوياً فقط)

⚠️ **تحذير:** عملية الاستعادة تحذف جميع البيانات الحالية!

### الخطوات الآمنة:

#### 1. إنشاء نسخة احتياطية قبل الاستعادة

```bash
ssh root@arasgroup.app
cd /var/www/arasgroup.app

# نسخة احتياطية احتياطية 😄
mysqldump -u rashiduser -p rashidgroup_db > pre-restore-backup.sql
```

#### 2. إيقاف التطبيق

```bash
pm2 stop arasgroup
```

#### 3. استعادة النسخة

```bash
mysql -u rashiduser -p rashidgroup_db < backup.sql
```

سيطلب كلمة المرور

#### 4. التحقق من البيانات

```bash
mysql -u rashiduser -p rashidgroup_db
```

```sql
SHOW TABLES;
SELECT COUNT(*) FROM User;
SELECT COUNT(*) FROM Company;
-- إلخ...
exit;
```

#### 5. إعادة تشغيل التطبيق

```bash
pm2 start arasgroup
```

#### 6. اختبار من المتصفح

افتح: https://arasgroup.app
تسجيل دخول + تحقق من البيانات

---

## استكشاف الأخطاء

### Cron لا يعمل؟

```bash
# تحقق من cron service
systemctl status cron

# تحقق من logs
tail -f /var/log/syslog | grep CRON
```

### الـ API لا يستجيب؟

```bash
# تحقق من PM2
pm2 list
pm2 logs arasgroup

# تحقق من المتغيرات البيئية
pm2 env 0 | grep R2
```

### النسخة الاحتياطية فارغة أو صغيرة جداً؟

تحقق من الـ logs في:
```bash
pm2 logs arasgroup --lines 100
```

ابحث عن `[CRON]` في الـ logs

---

## الصيانة

### حذف النسخ القديمة من R2

يُنصح بحذف النسخ الأقدم من 30 يوم لتوفير المساحة.

يمكنك:
1. يدوياً عبر Cloudflare Dashboard
2. أو إنشاء Lifecycle Policy في R2 لحذف الملفات تلقائياً بعد X يوم

---

## الأمان

✅ **ما تم تطبيقه:**
- استعادة أوتوماتيكية **معطلة** (خطيرة)
- Cron endpoint محمي بـ `Authorization: Bearer token`
- النسخ الاحتياطية على R2 خاصة (ليست public)

⚠️ **احرص على:**
- عدم مشاركة `CRON_SECRET`
- عدم رفع `.env` إلى GitHub
- حفظ النسخ المحلية في مكان مشفر
