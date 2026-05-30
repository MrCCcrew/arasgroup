import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, ArrowLeftRight, BadgeCheck, BookOpen, Calculator, CheckCircle2,
  CircleDot, FileText, Landmark, ListChecks, Receipt, ScrollText, TrendingUp, XCircle,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ companyId: string }>;
}

// خطوة في الدورة المحاسبية
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

  // ── حالة الجاهزية الحيّة ──
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
      label: "سنة مالية حالية مفتوحة",
      detail: currentFiscalYear
        ? currentFiscalYear.isLocked ? "السنة الحالية مقفلة — لا يمكن التسجيل فيها" : `السنة الحالية: ${currentFiscalYear.year}`
        : "لا توجد سنة مالية محدّدة كحالية",
      href: `${base}/fiscal-years`,
    },
    {
      ok: accountsCount > 0,
      label: "دليل الحسابات مُعد",
      detail: accountsCount > 0 ? `${accountsCount} حساب` : "دليل الحسابات فارغ",
      href: `${base}/accounts`,
    },
    {
      ok: bankCount > 0,
      label: "الحسابات البنكية والصناديق",
      detail: bankCount > 0 ? `${bankCount} حساب بنكي/صندوق` : "لا توجد حسابات بنكية أو صناديق",
      href: `${base}/bank-accounts`,
    },
    {
      ok: unpostedCount === 0,
      warn: unpostedCount > 0,
      label: "كل القيود مُرحّلة",
      detail: unpostedCount > 0
        ? `${unpostedCount} قيد غير مُرحّل لن يظهر في التقارير حتى تُرحّله`
        : "لا توجد قيود معلّقة",
      href: `${base}/journal-entries`,
    },
  ];

  const steps: Step[] = [
    {
      n: 1,
      title: "تجهيز السنة المالية",
      why: "كل قيد محاسبي يجب أن يقع داخل سنة مالية مفتوحة. بدون سنة حالية لن تستطيع تسجيل أي عملية.",
      todo: [
        "أنشئ السنة المالية وحدّد تاريخ البداية والنهاية.",
        "اجعلها «السنة الحالية» لتُسجّل عليها العمليات تلقائياً.",
        "لا تقفل السنة إلا بعد التأكد من ترحيل ومراجعة كل قيودها.",
      ],
      href: `${base}/fiscal-years`,
      hrefLabel: "السنوات المالية",
      mistakes: ["العمل بدون سنة حالية مفتوحة.", "إقفال السنة قبل ترحيل كل القيود."],
      icon: <BookOpen size={18} />,
    },
    {
      n: 2,
      title: "إعداد دليل الحسابات",
      why: "دليل الحسابات هو العمود الفقري؛ كل عملية تُسجَّل على حسابات منه (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات).",
      todo: [
        "تأكد من وجود الحسابات الرئيسية بتصنيفها الصحيح.",
        "استخدم أكواد واضحة ومرتّبة لتسهيل التقارير.",
        "لا تكرّر الحسابات؛ استخدم الحساب الصحيح لكل نوع عملية.",
      ],
      href: `${base}/accounts`,
      hrefLabel: "دليل الحسابات",
      mistakes: ["تسجيل عملية على حساب من تصنيف خاطئ (مثلاً مصروف على حساب أصل)."],
      icon: <ListChecks size={18} />,
    },
    {
      n: 3,
      title: "إعداد الحسابات البنكية والصناديق",
      why: "سندات القبض والصرف والتحويلات تتم من/إلى حساب بنكي أو صندوق محدّد، وتنعكس مباشرة على القيد.",
      todo: [
        "أضف كل حساب بنكي وكل صندوق نقدي تتعامل به الشركة.",
        "عند تسجيل سند، اختر الحساب البنكي/الصندوق الصحيح فعلياً.",
      ],
      href: `${base}/bank-accounts`,
      hrefLabel: "الحسابات البنكية",
      mistakes: ["ترك الحساب البنكي على الافتراضي بينما العملية تمّت من حساب آخر."],
      icon: <Landmark size={18} />,
    },
    {
      n: 4,
      title: "تسجيل العمليات اليومية",
      why: "معظم العمليات تُسجَّل من شاشات مبسّطة (قبض/صرف/تحويل) وتُنشئ القيد المحاسبي تلقائياً ومتوازناً.",
      todo: [
        "سند قبض: عند استلام نقدية/تحويل لصالح الشركة.",
        "سند صرف: عند دفع مصروف أو مستحق.",
        "تحويل: عند نقل مبلغ بين حسابين بنكيين/صندوقين للشركة نفسها.",
        "اختر دائماً الحساب البنكي/الصندوق الصحيح والتاريخ الصحيح.",
      ],
      href: `${base}/receipts`,
      hrefLabel: "سندات القبض",
      mistakes: ["خلط التاريخ أو الحساب.", "تسجيل العملية مرتين."],
      icon: <Receipt size={18} />,
    },
    {
      n: 5,
      title: "القيود اليدوية عند الحاجة",
      why: "بعض العمليات (تسويات، إهلاك، أرصدة افتتاحية) تحتاج قيداً يدوياً. القاعدة الذهبية: مجموع المدين = مجموع الدائن.",
      todo: [
        "أنشئ القيد وأضف سطوره بحيث يتوازن (مدين = دائن).",
        "اكتب وصفاً واضحاً وأرفق المرجع إن وُجد.",
        "تابع دورة الحالة حتى الترحيل (انظر الأسفل).",
      ],
      href: `${base}/journal-entries`,
      hrefLabel: "القيود اليومية",
      mistakes: ["قيد غير متوازن.", "ترك القيد مسودة دون ترحيل فلا يظهر في التقارير."],
      icon: <FileText size={18} />,
    },
    {
      n: 6,
      title: "المراجعة والترحيل (Post)",
      why: "القيد لا يؤثر في التقارير إلا بعد ترحيله (POSTED). القيود الآلية من العمليات تُرحَّل تلقائياً، أما اليدوية فترحّلها أنت بعد المراجعة.",
      todo: [
        "راجع القيد: التوازن، الحسابات، التاريخ، المبلغ.",
        "اعتمد ثم رحّل القيد ليُحتسب في الأرصدة والتقارير.",
        "لا تترك قيوداً معلّقة في آخر الشهر.",
      ],
      href: `${base}/journal-entries`,
      hrefLabel: "القيود اليومية",
      mistakes: ["نسيان ترحيل قيود مهمة فتظهر التقارير ناقصة."],
      icon: <BadgeCheck size={18} />,
    },
    {
      n: 7,
      title: "مراجعة التقارير",
      why: "التقارير تعكس فقط القيود المُرحّلة. ابدأ دائماً بميزان المراجعة للتأكد من توازن الدفاتر.",
      todo: [
        "ميزان المراجعة: تأكد أن إجمالي المدين = إجمالي الدائن.",
        "قائمة الدخل: الإيرادات مقابل المصروفات (الربح/الخسارة).",
        "الميزانية العمومية: الأصول = الخصوم + حقوق الملكية.",
        "دفتر الأستاذ: لتتبع حركة أي حساب بالتفصيل.",
      ],
      href: `${base}/reports/trial-balance`,
      hrefLabel: "ميزان المراجعة",
      mistakes: ["قراءة التقارير قبل ترحيل كل القيود."],
      icon: <TrendingUp size={18} />,
    },
    {
      n: 8,
      title: "الإقفال الدوري",
      why: "بعد اكتمال المراجعة، تُقفل الفترة/السنة لمنع التعديل عليها والحفاظ على سلامة الأرقام.",
      todo: [
        "تأكد أن كل القيود مُرحّلة والتقارير متوازنة.",
        "اقفل السنة المالية لمنع أي تعديل لاحق.",
      ],
      href: `${base}/fiscal-years`,
      hrefLabel: "السنوات المالية",
      mistakes: ["الإقفال قبل اكتمال الترحيل والمراجعة."],
      icon: <Calculator size={18} />,
    },
  ];

  // دورة حالة القيد المحاسبي
  const statusFlow = [
    { code: "DRAFT", label: "مسودة", desc: "قيد قيد التحضير، يمكن تعديله أو حذفه.", color: "bg-gray-100 text-gray-700" },
    { code: "PENDING_APPROVAL", label: "بانتظار الاعتماد", desc: "أُرسل للمراجعة قبل الاعتماد.", color: "bg-amber-100 text-amber-700" },
    { code: "APPROVED", label: "معتمد", desc: "تمت الموافقة، جاهز للترحيل.", color: "bg-blue-100 text-blue-700" },
    { code: "POSTED", label: "مُرحّل", desc: "أثّر في الأرصدة والتقارير، لا يُحذف ولا يُلغى.", color: "bg-emerald-100 text-emerald-700" },
    { code: "REJECTED", label: "مرفوض", desc: "رُفض في المراجعة، يعود لمسودة أو يُلغى.", color: "bg-red-100 text-red-700" },
    { code: "CANCELLED", label: "ملغي", desc: "أُلغي ولا يُحتسب.", color: "bg-gray-200 text-gray-600" },
  ];

  const goldenRules = [
    "في كل قيد: مجموع المدين = مجموع الدائن.",
    "القيد لا يظهر في التقارير إلا بعد ترحيله (POSTED).",
    "اختر الحساب البنكي/الصندوق الصحيح في كل سند.",
    "سجّل التاريخ الصحيح وتجنّب التسجيل المكرّر.",
    "راجع ميزان المراجعة دورياً قبل الإقفال.",
    "لا تقفل السنة المالية قبل ترحيل ومراجعة كل القيود.",
  ];

  return (
    <div>
      <Header
        title="دليل المحاسب — الدورة المحاسبية"
        subtitle="خطوات مرتّبة تمشّيك في النظام خطوة بخطوة لإتمام العمليات بترتيب محاسبي صحيح وبدون أخطاء"
        companyId={companyId}
      />

      <div className="page-container max-w-5xl space-y-6">

        {/* مقدمة */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-bold"><BookOpen size={16} /> ابدأ من هنا</p>
          <p className="mt-1 leading-relaxed">
            هذا الدليل يشرح الدورة المحاسبية كما يطبّقها النظام بالترتيب الصحيح. اتبع الخطوات من الأعلى للأسفل،
            وتأكد أولاً من «حالة الجاهزية» بالأسفل قبل تسجيل أي عملية.
          </p>
        </div>

        {/* حالة الجاهزية الحيّة */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ListChecks size={18} className="text-emerald-600" /> حالة الجاهزية الآن</h2>
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

        {/* خطوات الدورة المحاسبية */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ScrollText size={18} className="text-emerald-600" /> خطوات الدورة المحاسبية بالترتيب</h2>
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
                      {step.todo.map((t, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CircleDot size={13} className="mt-1 shrink-0 text-emerald-500" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                    {step.mistakes && step.mistakes.length > 0 && (
                      <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                        <span className="font-bold">⚠ أخطاء شائعة: </span>
                        {step.mistakes.join(" — ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* دورة حالة القيد */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><ArrowLeftRight size={18} className="text-emerald-600" /> دورة حالة القيد المحاسبي</h2>
          <p className="text-sm text-muted-foreground">
            القيد يمرّ بحالات واضحة، والنظام يمنع أي انتقال غير منطقي. القيد المُرحّل (POSTED) لا يُحذف ولا يُلغى للحفاظ على سلامة الدفاتر.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statusFlow.map((s) => (
              <div key={s.code} className="rounded-xl border bg-card p-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.color}`}>{s.label}</span>
                <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            المسار المعتاد: <strong>مسودة → (بانتظار الاعتماد) → معتمد → مُرحّل</strong>. القيود الآلية الناتجة من العمليات التشغيلية تُرحّل تلقائياً.
          </div>
        </section>

        {/* القواعد الذهبية */}
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-bold"><BadgeCheck size={18} className="text-emerald-600" /> القواعد الذهبية لتجنّب الأخطاء</h2>
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
