# تقرير الفحص المحاسبي الأولي
## تاريخ الفحص: 2026-07-25
## الفرع: fix/accounting-integrity-safe

---

## 1. هيكل النظام المحاسبي الحالي

### 1.1 Prisma Models
✅ **JournalEntry** - القيود اليومية
- حقول الحالة: status, isDeleted, isReversed
- حقول الترحيل: postedAt, postedById
- حقول العكس: reversedAt, reversedBy, reversalEntryId
- المجاميع: totalDebit, totalCredit (Decimal 18,3)
- onDelete Cascade على JournalEntryLine ✅

✅ **JournalEntryLine** - سطور القيود
- debit, credit (Decimal 18,3)
- onDelete: Cascade من JournalEntry ✅
- onDelete: Restrict على ChartOfAccount ✅

✅ **ChartOfAccount** - دليل الحسابات
- type: ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
- normalBalance: DEBIT | CREDIT
- isActive, isHeader, level

✅ **FiscalYear** - السنوات المالية
- year, startDate, endDate
- isLocked, isCurrent
- unique: [companyId, year]

✅ **OpeningBalance** - الأرصدة الافتتاحية
- accountId, fiscalYearId
- debit, credit
- unique: [accountId, fiscalYearId]

---

## 2. الأخطاء المحاسبية المُكتشَفة

### 2.1 خطأ في عرض الرصيد (مؤكد ✓)
**الموقع**: lib/accounting/reports.ts, lib/accounting/journal-engine.ts

**المشكلة**:
- النظام يحفظ الرصيد كـ: `balance = debit - credit`
- عند العرض، الأرقام السالبة تُعرض كأرقام سالبة (-100.000) بدلاً من (100.000 دائن)
- لا توجد دالة موحدة لعرض الرصيد بالاتجاه

**الأثر**:
- مستخدم يرى: -100.000 بدلاً من: 100.000 دائن
- عدم وضوح اتجاه الرصيد في التقارير

**الحل المطلوب**:
- إنشاء utility function لتنسيق العرض
- تطبيق على جميع نقاط العرض دون تغيير القيم المحفوظة

---

### 2.2 خطأ في رصيد أول الفترة في الأستاذ (مؤكد ✓)
**الموقع**: lib/accounting/reports.ts → getAccountLedger()

**الكود الحالي (سطر 244-253)**:
```typescript
let openingBalance = 0;
if (fiscalYearId) {
  const ob = await prisma.openingBalance.findFirst({
    where: { fiscalYearId, accountId },
  });
  if (ob) {
    openingBalance = Number(ob.debit) - Number(ob.credit);
  }
}
```

**المشكلة**:
- عند اختيار فترة (startDate, endDate) داخل السنة، الدالة تستخدم فقط الرصيد الافتتاحي للسنة
- **لا تحسب** الحركات المرحلة من بداية السنة حتى startDate
- النتيجة: رصيد أول الفترة خاطئ إذا بدأت الفترة في منتصف السنة

**الصيغة الصحيحة**:
```
رصيد أول الفترة = 
  الرصيد الافتتاحي للسنة 
  + صافي الحركات المرحلة من بداية السنة حتى (قبل startDate)
```

**الأثر**:
- تقارير الأستاذ الفردي غير دقيقة للفترات الجزئية
- مثال: سنة تبدأ 2026-01-01، رصيد افتتاحي 500 مدين، حركة في يناير 300 دائن
  - عند طلب تقرير من 2026-02-01 إلى 2026-02-28
  - النظام يعرض رصيد أول الفترة = 500 (خطأ)
  - الصحيح = 500 - 300 = 200 مدين

---

### 2.3 خطأ في ميزان المراجعة للفترات (مؤكد ✓)
**الموقع**: lib/accounting/journal-engine.ts → getTrialBalance()

**الكود الحالي (سطر 518-582)**:
```typescript
const periodLines = await prisma.journalEntryLine.groupBy({
  by: ["accountId"],
  where: {
    journalEntry: {
      companyId,
      fiscalYearId,
      status: "POSTED",
      isDeleted: false,
      ...(startDate || endDate ? { date: dateFilter } : {}),
    },
  },
  _sum: { debit: true, credit: true },
});

// ...

return accounts.map((account) => {
  const line = lineMap.get(account.id);
  const opening = openingMap.get(account.id);
  const openingDebit = Number(opening?.debit ?? 0);
  const openingCredit = Number(opening?.credit ?? 0);
  const periodDebit = Number(line?._sum?.debit ?? 0);
  const periodCredit = Number(line?._sum?.credit ?? 0);
  const closingDebit = openingDebit + periodDebit;
  const closingCredit = openingCredit + periodCredit;
  // ...
});
```

**المشكلة الأولى**:
- periodLines تحتسب فقط الحركات **داخل** الفترة (startDate to endDate)
- لا تحسب الحركات من بداية السنة حتى قبل startDate
- النتيجة: رصيد أول الفترة = الرصيد الافتتاحي فقط (خطأ)

**المشكلة الثانية**:
- closingDebit/closingCredit تُحسب كمجاميع منفصلة
- **لا تعكس** الرصيد الحقيقي (debit - credit)
- في المحاسبة، الرصيد = صافي (مدين - دائن)، ثم يُعرض في عمود واحد حسب الإشارة

**الصيغة الصحيحة**:
```
1. حركات قبل الفترة = query منفصل (fiscalYearId, date < startDate)
2. رصيد أول الفترة = افتتاحي السنة + حركات قبل الفترة
3. رصيد آخر الفترة = رصيد أول الفترة + حركات الفترة
4. العرض:
   - إذا net > 0 → عمود المدين
   - إذا net < 0 → عمود الدائن (بقيمة مطلقة)
```

**الأثر**:
- ميزان المراجعة للفترات الجزئية غير صحيح
- قد لا يتوازن المدين والدائن
- التقارير المالية المبنية عليه (قائمة الدخل، الميزانية) قد تكون خاطئة

---

### 2.4 خطأ محتمل في دفتر الأستاذ العام (مؤكد ✓)
**الموقع**: lib/accounting/reports.ts → getFullGeneralLedger()

**الكود الحالي (سطر 302-377)**:
```typescript
const lines = await prisma.journalEntryLine.findMany({
  where: {
    journalEntry: {
      companyId,
      status: "POSTED",
      isDeleted: false,
      ...(fiscalYearId ? { fiscalYearId } : {}),
      ...(startDate || endDate ? { date: {...} } : {}),
    },
  },
  // ...
});

// ...

for (const line of lines) {
  // ...
  entry.closingBalance += debit - credit;
  // ...
}
```

**المشكلة**:
- لا يبدأ من الرصيد الافتتاحي
- لا يحسب الحركات قبل startDate إذا كانت الفترة جزئية
- النتيجة: الرصيد الجاري يبدأ من صفر (خطأ)

**الأثر**:
- دفتر الأستاذ العام لا يطابق الأستاذ الفردي
- عدم تطابق مع ميزان المراجعة

---

### 2.5 خطأ في التحقق من توازن القيد (مؤكد ✓)
**الموقع**: lib/accounting/journal-engine.ts → validateBalance()

**الكود الحالي (سطر 58-65)**:
```typescript
function validateBalance(lines: JournalEntryLineInput[]): void {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`...`);
  }
}
```

**المشكلة الأولى**: جمع JavaScript number
- JavaScript number له مشاكل دقة عشرية معروفة
- مثال: 0.1 + 0.2 = 0.30000000000000004
- يجب استخدام Decimal أو integer arithmetic (×1000)

**المشكلة الثانية**: السماح بفرق 0.001 د.ك
- العملة الكويتية دقتها 3 منازل (0.001 د.ك = 1 فلس)
- السماح بفرق 0.001 يعني السماح بقيد غير متوازن بفلس واحد
- في المحاسبة، يجب أن يكون المدين = الدائن **تمامًا**

**الحل المطلوب**:
```typescript
// تحويل إلى فلوس صحيحة
const totalDebitFils = lines.reduce((sum, line) => sum + Math.round(line.debit * 1000), 0);
const totalCreditFils = lines.reduce((sum, line) => sum + Math.round(line.credit * 1000), 0);

if (totalDebitFils !== totalCreditFils) {
  throw new Error(`...`);
}
```

**الأثر**:
- قد يتم قبول قيود غير متوازنة
- تراكم أخطاء الدقة في التقارير

---

### 2.6 عدم التحقق من تاريخ القيد والسنة المالية (مؤكد ✓)
**الموقع**: lib/accounting/journal-engine.ts → createJournalEntry()

**الكود الحالي (سطر 113-124)**:
```typescript
export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  validateBalance(input.lines);

  const fiscalYearId = input.fiscalYearId ?? (await getCurrentFiscalYear(input.companyId));
  await checkFiscalYearNotLocked(fiscalYearId);

  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  const year = fiscalYear?.year ?? new Date().getFullYear();
  // ...
}
```

**المشكلة**:
- لا يتحقق من أن `input.date` داخل نطاق `fiscalYear.startDate` إلى `fiscalYear.endDate`
- يمكن إنشاء قيد بتاريخ 2026-07-01 على سنة 2025
- يمكن إنشاء قيد بتاريخ خارج جميع السنوات المالية

**الحل المطلوب**:
```typescript
if (fiscalYear) {
  if (input.date < fiscalYear.startDate || input.date > fiscalYear.endDate) {
    throw new Error("تاريخ القيد خارج نطاق السنة المالية");
  }
}
```

**الأثر**:
- قيود بتواريخ خاطئة
- تقارير مالية غير دقيقة
- صعوبة في الإقفال السنوي

---

### 2.7 عدم منع تداخل السنوات المالية (لم يُفحَص بعد)
**الموقع**: إدارة السنوات المالية (لم يُحدَّد الملف بعد)

**الحاجة**:
- التحقق من عدم تداخل سنتين لنفس الشركة
- ضمان سنة حالية واحدة فقط
- منع endDate قبل startDate

---

### 2.8 عدم التحقق الصارم من سطور القيود (مؤكد ✓)
**الموقع**: lib/accounting/journal-engine.ts → createJournalEntry()

**ما ينقص**:
- التحقق من عدم وجود debit و credit معًا في سطر واحد
- التحقق من عدم وجود سطر صفري (debit=0, credit=0)
- التحقق من عدم وجود قيم سالبة
- التحقق من أن الحساب ليس رئيسيًا (isHeader)
- التحقق من أن الحساب نشط (isActive) للقيود الجديدة
- التحقق من أن الحساب تابع لنفس الشركة

**الأثر**:
- قيود غير منطقية
- أخطاء محاسبية
- صعوبة في المراجعة

---

## 3. وظيفة الحذف النهائي (موجودة ✓)

### 3.1 السلوك الحالي
**الموقع**: app/api/accounting/journal-entries/[id]/route.ts

**الصلاحية**:
- `force=true` → للمدير الأعلى فقط (`isSuperAdmin`)
- بدون force → صلاحية DELETE عادية + القيد يجب أن يكون DRAFT/REJECTED/CANCELLED

**العملية (force delete)**:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. حذف حركات المحفظة المرتبطة
  const walletTxs = await tx.driverWalletTransaction.findMany({
    where: { journalEntryId: id },
  });
  for (const w of walletTxs) {
    await tx.driverWalletTransaction.delete({ where: { id: w.id } });
  }
  
  // 2. تعليم القيد كمحذوف (isDeleted: true)
  await tx.journalEntry.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  
  // 3. إعادة حساب أرصدة السائقين
  await recomputeDriverWalletStates(tx, driverIds);
  
  // 4. تسجيل في Audit Log
  await tx.auditLog.create({ ... action: "FORCE_DELETE" ... });
});
```

**ما يحتاج تحسين**:
✅ العملية داخل transaction ✓
❌ لا يحذف JournalEntryLine (يعتمد على cascade؟)
❌ لا ينظف المراجع الأخرى (Attachment, سندات، تحويلات)
❌ لا يتحقق من أن القيد ليس reversalEntry لقيد آخر
❌ لا يحفظ snapshot القيد قبل الحذف في Audit

**التوصية**:
- الحفاظ على الوظيفة الحالية
- تحسين الأمان والـ transaction integrity
- إضافة snapshot في AuditLog

---

## 4. ملفات التقارير المحاسبية

### 4.1 API Routes
- ✅ `app/api/accounting/reports/route.ts` → نقطة الدخول الموحدة
- ✅ `app/api/accounting/journal-entries/[id]/route.ts` → CRUD القيود
- ✅ `app/api/accounting/journal-entries/[id]/reverse/route.ts` → عكس القيود

### 4.2 Server Functions
- ✅ `lib/accounting/journal-engine.ts` → المحرك الأساسي
- ✅ `lib/accounting/reports.ts` → التقارير

### 4.3 Frontend Pages
- `app/(dashboard)/.../accounting/reports/account-ledger/page.tsx`
- `app/(dashboard)/.../accounting/reports/general-ledger/page.tsx`
- `app/(dashboard)/.../accounting/reports/trial-balance/page.tsx`
- `app/(dashboard)/.../accounting/reports/income-statement/page.tsx`
- `app/(dashboard)/.../accounting/reports/balance-sheet/page.tsx`

---

## 5. الحسابات غير النشطة

**السلوك المطلوب**:
- ✅ منع استخدام حساب غير نشط في قيد **جديد**
- ✅ عرض حساب غير نشط في التقارير **التاريخية** إذا له حركة أو رصيد
- ❌ الكود الحالي يستخدم `isActive: true` في queries التقارير (خطأ)

**الموقع**:
- `lib/accounting/journal-engine.ts:525` → `isActive: true` في getTrialBalance
- `lib/accounting/reports.ts:40` → `isActive: true` في getIncomeStatement
- `lib/accounting/reports.ts:128` → `isActive: true` في getBalanceSheet

**الحل**:
- إزالة فلتر `isActive: true` من التقارير
- إضافة التحقق في createJournalEntry/validateLines

---

## 6. السنوات المالية

### 6.1 getCurrentFiscalYear()
**المشكلة المحتملة**:
```typescript
const current = await prisma.fiscalYear.findFirst({
  where: { companyId, isCurrent: true },
});
if (current) return current.id;

// يُنشئ سنة جديدة تلقائيًا!
const created = await prisma.fiscalYear.create({ ... });
```

**الأثر**:
- إنشاء سنة تلقائيًا دون تأكيد
- قد تتداخل مع سنوات موجودة
- قد يتم اختيار سنة خاطئة

**التوصية**:
- عدم إنشاء سنة تلقائيًا
- رفع خطأ واضح "لا توجد سنة مالية حالية"

---

## 7. قائمة الدخل والميزانية

### 7.1 قائمة الدخل
**الكود الحالي**: يبدو صحيحًا منطقيًا
- يحسب: revenue (credit - debit), expense (debit - credit)
- netIncome = totalRevenue - totalExpenses

**لكن**:
- يعتمد على فلتر `isActive: true` (يخفي حسابات غير نشطة لها حركة)

### 7.2 الميزانية
**الكود الحالي**:
- يحسب assets, liabilities, equity من الأرصدة الافتتاحية + الحركات
- يجلب netIncome من قائمة الدخل
- **لكن** totalEquity لا يشمل netIncome في الحساب النهائي

**المشكلة**:
```typescript
const totalEquity = equity.filter((e) => !e.isHeader).reduce((s, e) => s + e.amount, 0);

return {
  totalAssets,
  totalLiabilities,
  totalEquity,    // ← لا يشمل netIncome
  netIncome,      // ← منفصل
};
```

**الصيغة الصحيحة**:
```
totalAssets = totalLiabilities + (totalEquity + netIncome)
```

**التوصية**:
- إضافة حقل `totalEquityIncludingNetIncome` واضح
- التحقق من توازن المعادلة المحاسبية

---

## 8. العكس (Reversal)

### 8.1 السلوك الحالي
**الموقع**: lib/accounting/journal-engine.ts → reverseJournalEntry()

**العملية** (داخل transaction ✓):
1. التحقق: القيد موجود، غير محذوف، مرحّل، غير معكوس، السنة غير مقفلة
2. تعليم القيد الأصلي: `isReversed: true`
3. إنشاء قيد عكسي (POSTED مباشرة)
4. ربط القيدين: `reversalEntryId`
5. إذا كان delivery wallet → حذف WalletTransaction وإعادة الحساب

**ما يحتاج مراجعة**:
✅ يمنع العكس مرتين ✓
✅ ينشئ قيد عكسي بتاريخ اليوم ✓
❌ **لا يتحقق** من أن تاريخ العكس داخل سنة مالية مفتوحة
❌ يستخدم fiscalYearId **نفس السنة الأصلية** (سطر 438)
   - إذا كان القيد الأصلي في 2025، والعكس في 2026، يجب أن يذهب العكس لسنة 2026

**الحل المطلوب**:
```typescript
const reversalDate = new Date();
// اختيار السنة المالية حسب تاريخ العكس، ليس تاريخ القيد الأصلي
const reversalFiscalYear = await findFiscalYearForDate(entry.companyId, reversalDate);
if (!reversalFiscalYear || reversalFiscalYear.isLocked) {
  throw new Error("لا توجد سنة مالية مفتوحة لتاريخ العكس");
}
```

---

## 9. التحويلات والسندات

**لم يتم فحصها بعد** - ستُفحص في مرحلة لاحقة.

**المطلوب**:
- التحقق من أن إنشاء التحويل/السند والقيد المرتبط atomic
- منع تكرار القيود الآلية (refModule + refId)
- تزامن الحالات

---

## 10. الخلاصة - الأولويات

### أولوية عالية جدًا (يؤثر على صحة البيانات)
1. ✅ إصلاح validateBalance (دقة المبالغ)
2. ✅ إصلاح رصيد أول الفترة في الأستاذ
3. ✅ إصلاح ميزان المراجعة للفترات
4. ✅ التحقق من تاريخ القيد والسنة المالية
5. ✅ التحقق الصارم من سطور القيود

### أولوية عالية (يؤثر على تجربة المستخدم)
6. ✅ إصلاح عرض الرصيد (مدين/دائن بدل سالب)
7. ✅ إصلاح دفتر الأستاذ العام
8. ✅ إصلاح الحسابات غير النشطة في التقارير

### أولوية متوسطة
9. ✅ تحسين الحذف النهائي (snapshot, cleanup)
10. ✅ إصلاح اختيار السنة في العكس
11. ✅ إصلاح حساب totalEquity في الميزانية

### أولوية منخفضة (تحسينات)
12. منع تداخل السنوات المالية
13. عدم إنشاء سنة تلقائيًا في getCurrentFiscalYear
14. فحص التحويلات والسندات

---

## 11. قائمة الملفات المتأثرة المتوقعة

### سيتم تعديلها:
1. `lib/accounting/journal-engine.ts` - المحرك الأساسي
2. `lib/accounting/reports.ts` - التقارير
3. `app/api/accounting/journal-entries/[id]/route.ts` - الحذف النهائي
4. `app/api/accounting/journal-entries/[id]/reverse/route.ts` - العكس (إن وُجد)

### قد تحتاج تعديل:
5. Frontend pages للتقارير (لعرض الرصيد الجديد)
6. Components العرض (formatBalance utility)

### لن تُعدَّل:
- ❌ `prisma/schema.prisma` - لا حاجة لـ migration
- ❌ `.env` - لن يُلمَس
- ❌ البيانات الحالية - قراءة فقط
- ❌ الملفات خارج نطاق المحاسبة

---

## 12. التأكيدات

✅ لم يتم تنفيذ أي أمر يغير البيانات
✅ لم يتم تعديل أي ملف
✅ لم يتم تنفيذ prisma db push
✅ لم يتم تنفيذ migration
✅ لم يتم لمس .env
✅ تم إنشاء فرع آمن: fix/accounting-integrity-safe
✅ تم حفظ نقطة الرجوع في .audit-safety/

---

## 13. الخطوات التالية

**المرحلة 1**: إضافة اختبارات Regression (بدون تعديل المنطق)
**المرحلة 2**: إصلاح عرض الرصيد
**المرحلة 3**: إصلاح الأستاذ ورصيد أول الفترة
**المرحلة 4**: إصلاح ميزان المراجعة
**المرحلة 5**: إصلاح تحقق القيود والدقة
**المرحلة 6**: إصلاح السنة المالية والترحيل
**المرحلة 7**: إصلاح السندات والتحويلات
**المرحلة 8**: إصلاح العكس
**المرحلة 9**: مراجعة قائمة الدخل والميزانية
**المرحلة 10**: تحسين الحذف النهائي

بعد كل مرحلة: typecheck + lint + test + commit

---

**نهاية التقرير**
