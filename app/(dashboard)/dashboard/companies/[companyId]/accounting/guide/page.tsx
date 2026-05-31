import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, BookOpen, Calculator, CheckCircle2,
  CircleDot, FileText, Landmark, ListChecks, Receipt, ScrollText, TrendingUp, XCircle,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ companyId: string }>;
}

interface Step {
  n: number;
  title: string;
  why: string;
  todo: string[];
  href?: string;
  hrefLabel?: string;
  mistakes?: string[];
  icon: React.ReactNode;
}

export default async function AccountingGuidePage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await params;
  const base = `/dashboard/companies/${companyId}/accounting`;
  const en = (await getLocale()) === "en";

  // ── Live readiness state ──
  const [currentFiscalYear, accountsCount, bankCount, unpostedCount] = await Promise.all([
    prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true }, select: { id: true, isLocked: true, year: true } }),
    prisma.chartOfAccount.count({ where: { companyId } }),
    prisma.bankAccount.count({ where: { companyId } }),
    prisma.journalEntry.count({
      where: { companyId, isDeleted: false, status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED"] } },
    }),
  ]);

  const checklist = [
    {
      ok: !!currentFiscalYear && !currentFiscalYear.isLocked,
      label: en ? "An open current fiscal year" : "سنة مالية حالية مفتوحة",
      detail: currentFiscalYear
        ? currentFiscalYear.isLocked
          ? (en ? "The current year is locked — entries cannot be recorded" : "السنة الحالية مقفلة — لا يمكن التسجيل فيها")
          : (en ? `Current year: ${currentFiscalYear.year}` : `السنة الحالية: ${currentFiscalYear.year}`)
        : (en ? "No fiscal year is set as current" : "لا توجد سنة مالية محدّدة كحالية"),
      href: `${base}/fiscal-years`,
    },
    {
      ok: accountsCount > 0,
      label: en ? "Chart of accounts is set up" : "دليل الحسابات مُعد",
      detail: accountsCount > 0 ? (en ? `${accountsCount} account(s)` : `${accountsCount} حساب`) : (en ? "Chart of accounts is empty" : "دليل الحسابات فارغ"),
      href: `${base}/accounts`,
    },
    {
      ok: bankCount > 0,
      label: en ? "Bank accounts & cash boxes" : "الحسابات البنكية والصناديق",
      detail: bankCount > 0 ? (en ? `${bankCount} bank/cash account(s)` : `${bankCount} حساب بنكي/صندوق`) : (en ? "No bank accounts or cash boxes" : "لا توجد حسابات بنكية أو صناديق"),
      href: `${base}/bank-accounts`,
    },
    {
      ok: unpostedCount === 0,
      warn: unpostedCount > 0,
      label: en ? "All entries are posted" : "كل القيود مُرحّلة",
      detail: unpostedCount > 0
        ? (en ? `${unpostedCount} unposted entr(ies) won't show in reports until posted` : `${unpostedCount} قيد غير مُرحّل لن يظهر في التقارير حتى تُرحّله`)
        : (en ? "No pending entries" : "لا توجد قيود معلّقة"),
      href: `${base}/journal-entries`,
    },
  ];

  const steps: Step[] = [
    {
      n: 1,
      title: en ? "Set up the fiscal year" : "تجهيز السنة المالية",
      why: en
        ? "Every entry must fall within an open fiscal year. Without a current year you cannot record any operation."
        : "كل قيد محاسبي يجب أن يقع داخل سنة مالية مفتوحة. بدون سنة حالية لن تستطيع تسجيل أي عملية.",
      todo: en
        ? ["Create the fiscal year and set its start and end dates.", "Mark it as the \"current year\" so operations post to it automatically.", "Do not lock the year until all its entries are posted and reviewed."]
        : ["أنشئ السنة المالية وحدّد تاريخ البداية والنهاية.", "اجعلها «السنة الحالية» لتُسجّل عليها العمليات تلقائياً.", "لا تقفل السنة إلا بعد التأكد من ترحيل ومراجعة كل قيودها."],
      href: `${base}/fiscal-years`,
      hrefLabel: en ? "Fiscal years" : "السنوات المالية",
      mistakes: en
        ? ["Working without an open current year.", "Locking the year before all entries are posted."]
        : ["العمل بدون سنة حالية مفتوحة.", "إقفال السنة قبل ترحيل كل القيود."],
      icon: <BookOpen size={18} />,
    },
    {
      n: 2,
      title: en ? "Set up the chart of accounts" : "إعداد دليل الحسابات",
      why: en
        ? "The chart of accounts is the backbone; every operation posts to accounts from it (assets, liabilities, equity, revenue, expenses)."
        : "دليل الحسابات هو العمود الفقري؛ كل عملية تُسجَّل على حسابات منه (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات).",
      todo: en
        ? ["Make sure the main accounts exist with the correct classification.", "Use clear, ordered codes to simplify reports.", "Do not duplicate accounts; use the right account per operation type."]
        : ["تأكد من وجود الحسابات الرئيسية بتصنيفها الصحيح.", "استخدم أكواد واضحة ومرتّبة لتسهيل التقارير.", "لا تكرّر الحسابات؛ استخدم الحساب الصحيح لكل نوع عملية."],
      href: `${base}/accounts`,
      hrefLabel: en ? "Chart of accounts" : "دليل الحسابات",
      mistakes: en
        ? ["Posting to an account of the wrong type (e.g. an expense on an asset account)."]
        : ["تسجيل عملية على حساب من تصنيف خاطئ (مثلاً مصروف على حساب أصل)."],
      icon: <ListChecks size={18} />,
    },
    {
      n: 3,
      title: en ? "Set up bank accounts & cash boxes" : "إعداد الحسابات البنكية والصناديق",
      why: en
        ? "Receipts, payments and transfers move to/from a specific bank account or cash box and are reflected directly in the entry."
        : "سندات القبض والصرف والتحويلات تتم من/إلى حساب بنكي أو صندوق محدّد، وتنعكس مباشرة على القيد.",
      todo: en
        ? ["Add every bank account and cash box the company uses.", "When recording a voucher, pick the actual correct bank/cash account."]
        : ["أضف كل حساب بنكي وكل صندوق نقدي تتعامل به الشركة.", "عند تسجيل سند، اختر الحساب البنكي/الصندوق الصحيح فعلياً."],
      href: `${base}/bank-accounts`,
      hrefLabel: en ? "Bank accounts" : "الحسابات البنكية",
      mistakes: en
        ? ["Leaving the bank account on default while the operation happened from another account."]
        : ["ترك الحساب البنكي على الافتراضي بينما العملية تمّت من حساب آخر."],
      icon: <Landmark size={18} />,
    },
    {
      n: 4,
      title: en ? "Record daily operations" : "تسجيل العمليات اليومية",
      why: en
        ? "Most operations are recorded from simple screens (receipt/payment/transfer) and create a balanced journal entry automatically."
        : "معظم العمليات تُسجَّل من شاشات مبسّطة (قبض/صرف/تحويل) وتُنشئ القيد المحاسبي تلقائياً ومتوازناً.",
      todo: en
        ? ["Receipt: when cash/transfer is received in the company's favour.", "Payment: when paying an expense or a due.", "Transfer: when moving an amount between two of the company's bank/cash accounts.", "Always choose the correct bank/cash account and the correct date."]
        : ["سند قبض: عند استلام نقدية/تحويل لصالح الشركة.", "سند صرف: عند دفع مصروف أو مستحق.", "تحويل: عند نقل مبلغ بين حسابين بنكيين/صندوقين للشركة نفسها.", "اختر دائماً الحساب البنكي/الصندوق الصحيح والتاريخ الصحيح."],
      href: `${base}/receipts`,
      hrefLabel: en ? "Receipt vouchers" : "سندات القبض",
      mistakes: en ? ["Mixing up the date or the account.", "Recording the operation twice."] : ["خلط التاريخ أو الحساب.", "تسجيل العملية مرتين."],
      icon: <Receipt size={18} />,
    },
    {
      n: 5,
      title: en ? "Manual entries when needed" : "القيود اليدوية عند الحاجة",
      why: en
        ? "Some operations (adjustments, depreciation, opening balances) need a manual entry. Golden rule: total debit = total credit."
        : "بعض العمليات (تسويات، إهلاك، أرصدة افتتاحية) تحتاج قيداً يدوياً. القاعدة الذهبية: مجموع المدين = مجموع الدائن.",
      todo: en
        ? ["Create the entry and add its lines so it balances (debit = credit).", "Write a clear description and attach a reference if any.", "Follow the status flow through to posting (see below)."]
        : ["أنشئ القيد وأضف سطوره بحيث يتوازن (مدين = دائن).", "اكتب وصفاً واضحاً وأرفق المرجع إن وُجد.", "تابع دورة الحالة حتى الترحيل (انظر الأسفل)."],
      href: `${base}/journal-entries`,
      hrefLabel: en ? "Journal entries" : "القيود اليومية",
      mistakes: en ? ["An unbalanced entry.", "Leaving the entry as a draft without posting, so it won't show in reports."] : ["قيد غير متوازن.", "ترك القيد مسودة دون ترحيل فلا يظهر في التقارير."],
      icon: <FileText size={18} />,
    },
    {
      n: 6,
      title: en ? "Review & post" : "المراجعة والترحيل (Post)",
      why: en
        ? "An entry only affects reports after it is posted (POSTED). Automatic entries from operations post automatically; manual ones you post after review."
        : "القيد لا يؤثر في التقارير إلا بعد ترحيله (POSTED). القيود الآلية من العمليات تُرحَّل تلقائياً، أما اليدوية فترحّلها أنت بعد المراجعة.",
      todo: en
        ? ["Review the entry: balance, accounts, date, amount.", "Approve then post the entry so it counts in balances and reports.", "Don't leave pending entries at month end."]
        : ["راجع القيد: التوازن، الحسابات، التاريخ، المبلغ.", "اعتمد ثم رحّل القيد ليُحتسب في الأرصدة والتقارير.", "لا تترك قيوداً معلّقة في آخر الشهر."],
      href: `${base}/journal-entries`,
      hrefLabel: en ? "Journal entries" : "القيود اليومية",
      mistakes: en ? ["Forgetting to post important entries so reports come out incomplete."] : ["نسيان ترحيل قيود مهمة فتظهر التقارير ناقصة."],
      icon: <BadgeCheck size={18} />,
    },
    {
      n: 7,
      title: en ? "Review reports" : "مراجعة التقارير",
      why: en
        ? "Reports reflect only posted entries. Always start with the trial balance to confirm the books are balanced."
        : "التقارير تعكس فقط القيود المُرحّلة. ابدأ دائماً بميزان المراجعة للتأكد من توازن الدفاتر.",
      todo: en
        ? ["Trial balance: confirm total debit = total credit.", "Income statement: revenue vs. expenses (profit/loss).", "Balance sheet: assets = liabilities + equity.", "General ledger: to trace any account's movement in detail."]
        : ["ميزان المراجعة: تأكد أن إجمالي المدين = إجمالي الدائن.", "قائمة الدخل: الإيرادات مقابل المصروفات (الربح/الخسارة).", "الميزانية العمومية: الأصول = الخصوم + حقوق الملكية.", "دفتر الأستاذ: لتتبع حركة أي حساب بالتفصيل."],
      href: `${base}/reports/trial-balance`,
      hrefLabel: en ? "Trial balance" : "ميزان المراجعة",
      mistakes: en ? ["Reading reports before all entries are posted."] : ["قراءة التقارير قبل ترحيل كل القيود."],
      icon: <TrendingUp size={18} />,
    },
    {
      n: 8,
      title: en ? "Periodic closing" : "الإقفال الدوري",
      why: en
        ? "After review is complete, the period/year is locked to prevent edits and preserve the integrity of the figures."
        : "بعد اكتمال المراجعة، تُقفل الفترة/السنة لمنع التعديل عليها والحفاظ على سلامة الأرقام.",
      todo: en
        ? ["Confirm all entries are posted and reports are balanced.", "Lock the fiscal year to prevent any later edits."]
        : ["تأكد أن كل القيود مُرحّلة والتقارير متوازنة.", "اقفل السنة المالية لمنع أي تعديل لاحق."],
      href: `${base}/fiscal-years`,
      hrefLabel: en ? "Fiscal years" : "السنوات المالية",
      mistakes: en ? ["Closing before posting and review are complete."] : ["الإقفال قبل اكتمال الترحيل والمراجعة."],
      icon: <Calculator size={18} />,
    },
  ];

  const statusFlow = [
    { code: "DRAFT", label: en ? "Draft" : "مسودة", desc: en ? "Being prepared; can be edited or deleted." : "قيد قيد التحضير، يمكن تعديله أو حذفه.", color: "bg-gray-100 text-gray-700" },
    { code: "PENDING_APPROVAL", label: en ? "Pending approval" : "بانتظار الاعتماد", desc: en ? "Sent for review before approval." : "أُرسل للمراجعة قبل الاعتماد.", color: "bg-amber-100 text-amber-700" },
    { code: "APPROVED", label: en ? "Approved" : "معتمد", desc: en ? "Approved, ready to post." : "تمت الموافقة، جاهز للترحيل.", color: "bg-blue-100 text-blue-700" },
    { code: "POSTED", label: en ? "Posted" : "مُرحّل", desc: en ? "Affected balances and reports; cannot be deleted or cancelled." : "أثّر في الأرصدة والتقارير، لا يُحذف ولا يُلغى.", color: "bg-emerald-100 text-emerald-700" },
    { code: "REJECTED", label: en ? "Rejected" : "مرفوض", desc: en ? "Rejected in review; returns to draft or is cancelled." : "رُفض في المراجعة، يعود لمسودة أو يُلغى.", color: "bg-red-100 text-red-700" },
    { code: "CANCELLED", label: en ? "Cancelled" : "ملغي", desc: en ? "Cancelled and not counted." : "أُلغي ولا يُحتسب.", color: "bg-gray-200 text-gray-600" },
  ];

  const goldenRules = en
    ? [
        "In every entry: total debit = total credit.",
        "An entry shows in reports only after it is posted (POSTED).",
        "Pick the correct bank/cash account on every voucher.",
        "Record the correct date and avoid duplicate recording.",
        "Review the trial balance regularly before closing.",
        "Do not lock the fiscal year before all entries are posted and reviewed.",
      ]
    : [
        "في كل قيد: مجموع المدين = مجموع الدائن.",
        "القيد لا يظهر في التقارير إلا بعد ترحيله (POSTED).",
        "اختر الحساب البنكي/الصندوق الصحيح في كل سند.",
        "سجّل التاريخ الصحيح وتجنّب التسجيل المكرّر.",
        "راجع ميزان المراجعة دورياً قبل الإقفال.",
        "لا تقفل السنة المالية قبل ترحيل ومراجعة كل القيود.",
      ];

  const tr = {
    title: en ? "Accountant Guide — Accounting Cycle" : "دليل المحاسب — الدورة المحاسبية",
    subtitle: en
      ? "Ordered steps that walk you through the system to complete operations in the right accounting order and without errors"
      : "خطوات مرتّبة تمشّيك في النظام خطوة بخطوة لإتمام العمليات بترتيب محاسبي صحيح وبدون أخطاء",
    startHere: en ? "Start here" : "ابدأ من هنا",
    intro: en
      ? "This guide explains the accounting cycle exactly as the system applies it, in the right order. Follow the steps top to bottom, and first check the \"Readiness\" section below before recording any operation."
      : "هذا الدليل يشرح الدورة المحاسبية كما يطبّقها النظام بالترتيب الصحيح. اتبع الخطوات من الأعلى للأسفل، وتأكد أولاً من «حالة الجاهزية» بالأسفل قبل تسجيل أي عملية.",
    readinessNow: en ? "Readiness now" : "حالة الجاهزية الآن",
    cycleSteps: en ? "Accounting cycle steps in order" : "خطوات الدورة المحاسبية بالترتيب",
    commonMistakes: en ? "Common mistakes:" : "أخطاء شائعة:",
    statusTitle: en ? "Journal entry status flow" : "دورة حالة القيد المحاسبي",
    statusIntro: en
      ? "An entry moves through clear statuses, and the system blocks any illogical transition. A posted (POSTED) entry cannot be deleted or cancelled, to preserve the books' integrity."
      : "القيد يمرّ بحالات واضحة، والنظام يمنع أي انتقال غير منطقي. القيد المُرحّل (POSTED) لا يُحذف ولا يُلغى للحفاظ على سلامة الدفاتر.",
    usualPath: en
      ? <>Usual path: <strong>Draft → (Pending approval) → Approved → Posted</strong>. Automatic entries from operational events are posted automatically.</>
      : <>المسار المعتاد: <strong>مسودة → (بانتظار الاعتماد) → معتمد → مُرحّل</strong>. القيود الآلية الناتجة من العمليات التشغيلية تُرحّل تلقائياً.</>,
    goldenTitle: en ? "Golden rules to avoid errors" : "القواعد الذهبية لتجنّب الأخطاء",
  };

  return (
    <div>
      <Header title={tr.title} subtitle={tr.subtitle} companyId={companyId} />

      <div className="page-container max-w-5xl space-y-6">

        {/* Intro */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-bold"><BookOpen size={16} /> {tr.startHere}</p>
          <p className="mt-1 leading-relaxed">{tr.intro}</p>
        </div>

        {/* Live readiness */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ListChecks size={18} className="text-emerald-600" /> {tr.readinessNow}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {checklist.map((c) => (
              <Link key={c.label} href={c.href} className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/30">
                {c.ok
                  ? <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                  : c.warn
                    ? <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-500" />
                    : <XCircle size={20} className="mt-0.5 shrink-0 text-red-500" />}
                <div className="flex-1">
                  <p className="font-medium group-hover:underline">{c.label}</p>
                  <p className={`text-xs ${c.ok ? "text-muted-foreground" : c.warn ? "text-amber-600" : "text-red-600"}`}>{c.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Cycle steps */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ScrollText size={18} className="text-emerald-600" /> {tr.cycleSteps}</h2>
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.n} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                    {step.n}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-bold">
                        <span className="text-emerald-600">{step.icon}</span>
                        {step.title}
                      </h3>
                      {step.href && (
                        <Link href={step.href} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                          {step.hrefLabel} ←
                        </Link>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.why}</p>
                    <ul className="space-y-1 text-sm">
                      {step.todo.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CircleDot size={13} className="mt-1 shrink-0 text-emerald-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    {step.mistakes && step.mistakes.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                        <span className="font-bold">⚠ {tr.commonMistakes} </span>
                        {step.mistakes.join(" — ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Status flow */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ArrowLeftRight size={18} className="text-emerald-600" /> {tr.statusTitle}</h2>
          <p className="text-sm text-muted-foreground">{tr.statusIntro}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statusFlow.map((s) => (
              <div key={s.code} className="rounded-xl border bg-card p-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {tr.usualPath}
          </div>
        </section>

        {/* Golden rules */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><BadgeCheck size={18} className="text-emerald-600" /> {tr.goldenTitle}</h2>
          <div className="rounded-xl border bg-card p-4">
            <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {goldenRules.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

      </div>
    </div>
  );
}
