# نظام بوابة السائق - Driver Portal MVP

## 📋 نظرة عامة

نظام متكامل لإدارة السائقين وعمال غسيل السيارات يتضمن:
- بوابة ويب للسائقين (PWA)
- رفع الفواتير بالكاميرا
- تتبع GPS أثناء الدوام
- لوحة تحكم للأدمن

---

## 🚀 التثبيت والإعداد

### 1. تطبيق Database Migration

**⚠️ مهم جداً:** يجب تطبيق الـmigration على قاعدة البيانات قبل البدء

```bash
# طريقة 1: MySQL Command Line
mysql -u root -p rashidgroup_db < prisma/migrations/driver_portal_mvp.sql

# طريقة 2: استيراد من phpMyAdmin
# افتح phpMyAdmin → اختر قاعدة rashidgroup_db → Import → اختر driver_portal_mvp.sql

# طريقة 3: Prisma DB Push (إذا كانت قاعدة تطوير)
npx prisma db push
```

### 2. توليد Prisma Client

```bash
npx prisma generate
```

### 3. إعادة تشغيل التطبيق

```bash
# Development
npm run dev

# Production (على السيرفر)
pm2 reload arasgroup
```

---

## 👥 إدارة الحسابات (للأدمن)

### إنشاء حساب سائق جديد

1. اذهب إلى: `/dashboard/companies/[company-id]/driver-accounts`
2. اضغط "إنشاء حساب سائق"
3. اختر الموظف (سائق أو عامل غسيل)
4. أدخل البريد الإلكتروني وكلمة المرور
5. اختياري: تفعيل "يجب تغيير كلمة المرور عند أول تسجيل"

**شروط:**
- يجب أن يكون الموظف من نوع `DRIVER` أو `CAR_WASH_WORKER`
- البريد الإلكتروني يجب أن يكون فريداً
- كلمة المرور 8 أحرف على الأقل

---

## 📱 بوابة السائق

### الوصول

- **URL:** `https://arasgroup.app/driver`
- **التوجيه التلقائي:** عند تسجيل دخول سائق، يتم التوجيه تلقائياً لـ `/driver`

### الصفحات المتاحة

#### 1. الصفحة الرئيسية (`/driver`)
- إحصائيات الفواتير (قيد المراجعة، موافق عليها، مرفوضة)
- أزرار سريعة للوظائف الأساسية

#### 2. رفع الفواتير (`/driver/invoices/upload`)
**الخطوات:**
1. اختر الصورة (كاميرا أو معرض)
2. أدخل تاريخ الفاتورة
3. أدخل المبلغ بالدينار الكويتي
4. ملاحظات (اختياري)
5. اضغط "رفع الفاتورة"

**التقنيات:**
- `accept="image/*"` لقبول جميع الصور
- `capture="environment"` لفتح الكاميرا مباشرة
- رفع إلى Cloudflare R2
- idempotency باستخدام `clientGeneratedId`

#### 3. قائمة الفواتير (`/driver/invoices`)
- عرض جميع الفواتير المرفوعة
- حالة المراجعة (قيد المراجعة، موافق عليها، مرفوضة)
- سبب الرفض (إذا كانت مرفوضة)

#### 4. التتبع (`/driver/tracking`)
**الوظائف:**
- بدء جلسة تتبع GPS
- إرسال الموقع كل 30 ثانية
- أو عند 10 نقاط GPS
- إيقاف الجلسة

**⚠️ ملاحظات مهمة:**
- التتبع يعمل فقط عند فتح الصفحة (foreground only)
- يجب السماح للمتصفح بالوصول للموقع
- يستنزف البطارية - تأكد من الشحن

#### 5. الملف الشخصي (`/driver/profile`)
- عرض البيانات الشخصية
- معلومات الشركة والفرع
- تسجيل الخروج

---

## 🔐 الأمان

### Server-side ID Extraction
```typescript
// ❌ خطأ - لا تثق في IDs من العميل
const { employeeId } = await request.json();

// ✅ صحيح - استخرج من الـsession
const session = await getSession();
const employeeId = session.employeeId;
```

### Idempotency
- جميع عمليات الرفع تستخدم `clientGeneratedId`
- منع التكرار عند إعادة المحاولة
- `skipDuplicates: true` في `createMany`

### Permissions
- RBAC كامل على جميع APIs
- فحص `accountType` في الـmiddleware
- توجيه تلقائي حسب نوع الحساب

---

## 📊 Database Schema

### حقول User الجديدة
```prisma
employeeId        String?         @unique
accountType       UserAccountType @default(ADMIN)
mustChangePassword Boolean        @default(false)
```

### DeliveryInvoice Updates
```prisma
reviewStatus      InvoiceReviewStatus @default(APPROVED)
reviewedById      String?
reviewedAt        DateTime?
rejectionReason   String?
uploadSource      InvoiceUploadSource @default(ADMIN)
clientGeneratedId String?             @unique
```

### GPS Tracking Tables
- `DriverTrackingSession`: جلسات التتبع
- `DriverLocationPoint`: نقاط GPS (batch insert)

---

## 🔄 API Endpoints

### Driver APIs

#### Upload Invoice
```http
POST /api/driver/invoices
Content-Type: multipart/form-data

file: File
clientGeneratedId: string
invoiceDate: YYYY-MM-DD
amount: number
currency: string (default: KWD)
notes: string (optional)
```

#### Get My Invoices
```http
GET /api/driver/invoices
```

#### Start Tracking Session
```http
POST /api/driver/tracking/session/start
Content-Type: application/json

{
  "deviceInfo": "Mozilla/5.0..."
}
```

#### End Tracking Session
```http
POST /api/driver/tracking/session/end
Content-Type: application/json

{
  "sessionId": "clxxx"
}
```

#### Send GPS Locations (Batch)
```http
POST /api/driver/tracking/location
Content-Type: application/json

{
  "sessionId": "clxxx",
  "locations": [
    {
      "clientGeneratedId": "unique-id",
      "latitude": 29.3759,
      "longitude": 47.9774,
      "accuracy": 10.5,
      "recordedAt": "2026-07-24T12:00:00Z"
    }
  ]
}
```

### Admin APIs

#### Review Invoice
```http
POST /api/driver/invoices/[id]/review
Content-Type: application/json

{
  "action": "APPROVE" | "REJECT",
  "rejectionReason": "string" (required if REJECT)
}
```

#### Create Driver Account
```http
POST /api/driver-accounts
Content-Type: application/json

{
  "companyId": "string",
  "employeeId": "string",
  "email": "string",
  "password": "string",
  "mustChangePassword": boolean
}
```

#### Get Employees Without Accounts
```http
GET /api/companies/[companyId]/employees?withoutAccounts=true&types=DRIVER,CAR_WASH_WORKER
```

---

## 🎨 UI/UX

### Mobile-First Design
- Bottom Navigation (4 tabs)
- Touch-friendly buttons (min height 44px)
- Large tap areas
- RTL support كامل

### PWA Features
- Manifest.json محدّث
- Service Worker للـcaching
- Install prompt على الموبايل
- Offline-ready (pages cached)

### Colors & Status
```
قيد المراجعة: bg-yellow-100 text-yellow-800
موافق عليها: bg-green-100 text-green-800
مرفوضة: bg-red-100 text-red-800
```

---

## 🧪 الاختبار

### اختبار رفع الفواتير
1. سجّل دخول كسائق
2. اذهب لـ `/driver/invoices/upload`
3. التقط صورة أو اختر من المعرض
4. أدخل البيانات وارفع
5. تحقق من `/driver/invoices` للتأكد

### اختبار GPS Tracking
1. اذهب لـ `/driver/tracking`
2. اسمح بالوصول للموقع
3. اضغط "بدء التتبع"
4. راقب عدد النقاط المرسلة
5. تحقق من DB: `driver_location_points`

### اختبار مراجعة الفواتير (Admin)
1. سجّل دخول كأدمن
2. اذهب لصفحة الفواتير
3. ابحث عن فواتير `PENDING_REVIEW`
4. وافق أو ارفض
5. تحقق من ظهور الحالة في بوابة السائق

---

## 📝 الميزات المؤجلة

- ❌ تطبيقات Native (Android/iOS)
- ❌ GPS Background tracking
- ❌ دعم 6 لغات (فقط العربية الآن)
- ❌ Offline sync متقدم
- ❌ Push Notifications
- ❌ Version history للفواتير
- ❌ Admin tracking dashboard (خرائط)
- ❌ Reports وإحصائيات متقدمة

---

## 🐛 استكشاف الأخطاء

### لا يعمل GPS
- تأكد من السماح بالموقع في المتصفح
- تأكد من فتح الصفحة (لا background)
- تحقق من Console للأخطاء
- جرّب HTTPS (مطلوب للـGeolocation)

### فشل رفع الفاتورة
- تحقق من حجم الصورة (max 10MB)
- تحقق من نوع الملف (image/* فقط)
- تحقق من Cloudflare R2 credentials
- راجع Server logs

### لا يظهر الموظف في القائمة
- تأكد من نوع الموظف (`DRIVER` أو `CAR_WASH_WORKER`)
- تأكد من عدم وجود حساب مسبقاً
- تحقق من `deletedAt = null`

---

## 📦 الملفات المهمة

```
prisma/
  schema.prisma                           # Schema updates
  migrations/driver_portal_mvp.sql        # SQL migration script

app/(authenticated)/driver/
  layout.tsx                              # Driver portal layout
  page.tsx                                # Driver home
  invoices/page.tsx                       # Invoices list
  invoices/upload/page.tsx                # Upload invoice
  tracking/page.tsx                       # GPS tracking
  profile/page.tsx                        # Profile

app/(dashboard)/dashboard/companies/[companyId]/
  driver-accounts/page.tsx                # Manage accounts
  driver-accounts/create/page.tsx         # Create account

app/api/
  driver/
    invoices/route.ts                     # Upload & list
    invoices/[id]/review/route.ts         # Approve/reject
    tracking/session/start/route.ts       # Start session
    tracking/session/end/route.ts         # End session
    tracking/location/route.ts            # Save GPS points
  driver-accounts/route.ts                # Create account
  companies/[companyId]/employees/route.ts # Get employees

components/
  driver/bottom-nav.tsx                   # Bottom navigation
  auth/logout-button.tsx                  # Logout button

lib/
  auth/session.ts                         # Session with accountType
  types/index.ts                          # SessionUser updates
  utils/currency.ts                       # Currency formatter

middleware.ts                             # Route by accountType
```

---

## 🎯 Next Steps

1. ✅ تطبيق الـmigration على Production
2. ⏳ إنشاء حسابات للسائقين الموجودين
3. ⏳ اختبار كامل على الموبايل
4. ⏳ إضافة Admin tracking dashboard
5. ⏳ تحسين Performance (lazy loading, image optimization)
6. ⏳ إضافة Notifications
7. ⏳ Analytics وReports

---

## 📞 الدعم

للمشاكل التقنية:
- راجع Server logs: `pm2 logs arasgroup`
- راجع Browser console
- تحقق من Network tab
- راجع Database logs

---

**تاريخ الإنشاء:** 2026-07-24  
**الإصدار:** MVP 1.0  
**الحالة:** ✅ جاهز للاختبار (بعد تطبيق Migration)
