# Accounting Integrity Tests

هذه الاختبارات تضمن سلامة النظام المحاسبي وصحة الحسابات والتقارير.

## ⚠️ تحذير هام

**ممنوع منعًا باتًا تشغيل هذه الاختبارات على قاعدة البيانات الحقيقية (Production)**

يجب استخدام قاعدة بيانات اختبار منفصلة تمامًا، أو استخدام mocks للبيانات.

## التشغيل

```bash
# اختبار واحد
node --test tests/accounting/journal-engine.test.ts

# كل اختبارات المحاسبة
node --test tests/accounting/*.test.ts

# مع تقرير مفصل
node --test --test-reporter=spec tests/accounting/*.test.ts
```

## هيكل الاختبارات

### 1. journal-engine.test.ts (23 tests - Helper-based)
- **Balance Validation** (Tests 1-5): التحقق من توازن القيد باستخدام integer arithmetic
- **Line Validation** (Tests 6-16): التحقق من صحة سطور القيد
- **Fiscal Year Validation** (Tests 17-21): التحقق من تاريخ القيد والسنة المالية
- **Integration** (Tests 22-23): اختبارات شاملة
- ⚠️ These test **helper functions** (expected behavior), not production code

### 2. ledger-reports.test.ts (19 tests - Helper-based)
- **Opening Balance** (Tests 24-28): حساب رصيد أول الفترة
- **Running Balance** (Tests 29-31): حساب الرصيد الجاري
- **Display Formatting** (Tests 32-36): عرض الرصيد (مدين/دائن)
- **Trial Balance** (Tests 37-40): ميزان المراجعة للفترات الجزئية
- **Edge Cases** (Tests 41-42): حالات خاصة
- ⚠️ These test **helper functions** (expected behavior), not production code

### 3. production-behavior.test.ts (9 tests - Production-linked)
- **validateBalance Behavior** (Tests 43-44): Document current bugs in production
- **getAccountLedger Bug** (Test 45): Document opening balance calculation bug
- **Force Delete Requirements** (Tests 46-48): Protection, atomicity, isolation
- **Reversal Fiscal Year** (Tests 49-50): Document fiscal year selection bug
- **Trial Balance Period** (Test 51): Document period calculation bug
- ✅ These document **actual production code** behavior and bugs

## إجمالي التغطية الحالية

**51 test case** تغطي:

✅ دقة المبالغ (integer arithmetic بالفلوس)
✅ توازن القيد (debit = credit تمامًا)
✅ التحقق من السطور (لا مدين ودائن معًا، لا قيم سالبة، لا NaN)
✅ التحقق من التاريخ والسنة المالية
✅ حساب رصيد أول الفترة مع الحركات السابقة
✅ حساب الرصيد الجاري
✅ عرض الرصيد (100.000 دائن بدل -100.000)
✅ ميزان المراجعة للفترات الجزئية
✅ توازن مجاميع ميزان المراجعة

## الاختبارات المتبقية (سيتم إضافتها في الدفعة الثانية)

- [ ] Delete & Force Delete (حذف عادي وحذف نهائي)
- [ ] Reversal (عكس القيد ومنع التكرار)
- [ ] Posting (ترحيل مع إعادة التحقق)
- [ ] Inactive Accounts (الحسابات غير النشطة في التقارير)
- [ ] General Ledger (دفتر الأستاذ العام)
- [ ] Income Statement & Balance Sheet

## الصيغ المحاسبية المستخدمة

### رصيد أول الفترة
```
Period Opening Balance = 
  Fiscal Year Opening Balance 
  + Prior Movements (from year start to before period start)
```

### الرصيد الجاري
```
Running Balance = 
  Period Opening Balance 
  + Σ(Debit - Credit) for each movement in order
```

### ميزان المراجعة
```
Opening Debit/Credit = split period opening balance by sign
Period Debit/Credit = sum of movements in period
Closing Debit/Credit = split closing balance by sign

Where: Closing Balance = Opening Balance + Period Debit - Period Credit
```

### التوازن
```
Σ Opening Debit = Σ Opening Credit
Σ Period Debit = Σ Period Credit
Σ Closing Debit = Σ Closing Credit
```

## Utilities المستخرجة

الاختبارات تحتوي على utilities يجب نقلها إلى الكود الحقيقي:

- `validateBalancePrecise()` → `lib/accounting/validation.ts`
- `validateJournalLines()` → `lib/accounting/validation.ts`
- `validateDateInFiscalYear()` → `lib/accounting/validation.ts`
- `calculatePeriodOpeningBalance()` → `lib/accounting/balance.ts`
- `calculateRunningBalances()` → `lib/accounting/balance.ts`
- `formatSignedBalance()` → `lib/accounting/format.ts`
- `calculateTrialBalance()` → `lib/accounting/reports.ts`

## ملاحظات

- جميع الاختبارات تستخدم Node.js built-in test runner (لا حاجة لـ Jest أو Vitest)
- لا توجد dependencies إضافية
- الاختبارات pure functions بدون اتصال بقاعدة البيانات (في هذه المرحلة)
- يمكن دمجها لاحقًا مع Prisma test database عند الحاجة

## التالي

الدفعة الثانية ستضيف:
- Reversal tests
- Delete tests  
- Posting tests
- Account validation tests
- Integration tests مع mock Prisma client
