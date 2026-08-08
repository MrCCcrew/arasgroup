import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { getCashMovementReport } from "@/lib/accounting/reports";
import { formatKWD } from "@/lib/utils";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ fiscalYearId?: string; fromDate?: string; toDate?: string }>;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+03:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function CashFlowPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!hasPermission(session, "ACCOUNTING", "VIEW", { companyId })) notFound();

  const [locale, company] = await Promise.all([
    getLocale(),
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true, nameEn: true } }),
  ]);
  const fiscalYear = sp.fiscalYearId
    ? await prisma.fiscalYear.findFirst({ where: { id: sp.fiscalYearId, companyId } })
    : await prisma.fiscalYear.findFirst({ where: { companyId, isCurrent: true } });
  const fiscalYears = await prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { year: "desc" } });
  const fromDate = parseDate(sp.fromDate) ?? fiscalYear?.startDate;
  const toDate = parseDate(sp.toDate, true) ?? fiscalYear?.endDate;
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);
  const report = fiscalYear && fromDate && toDate && !invalidRange
    ? await getCashMovementReport(companyId, fiscalYear.id, fromDate, toDate)
    : null;
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = (ar: string, english: string) => en ? english : ar;

  return <div>
    <Header title={t("حركة النقد", "Cash Movement")} subtitle={en ? company?.nameEn ?? company?.nameAr : company?.nameAr} companyId={companyId} />
    <main className="page-container space-y-4">
      <form method="get" className="section-card"><div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm"><span>{t("السنة المالية", "Fiscal year")}</span><select name="fiscalYearId" defaultValue={fiscalYear?.id ?? ""} className="input-field">{fiscalYears.map((year) => <option key={year.id} value={year.id}>{year.year}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>{t("من تاريخ", "From date")}</span><input type="date" name="fromDate" defaultValue={sp.fromDate ?? fiscalYear?.startDate.toISOString().slice(0, 10)} className="input-field" dir="ltr" /></label>
        <label className="space-y-1 text-sm"><span>{t("إلى تاريخ", "To date")}</span><input type="date" name="toDate" defaultValue={sp.toDate ?? fiscalYear?.endDate.toISOString().slice(0, 10)} className="input-field" dir="ltr" /></label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">{t("عرض", "Show")}</button>
      </div>{invalidRange && <p className="mt-3 text-sm text-destructive">{t("يجب أن يكون تاريخ البداية قبل تاريخ النهاية أو مساويًا له.", "From date must be before or equal to To date.")}</p>}</form>

      {!fiscalYear || !report ? <div className="section-card text-center text-muted-foreground">{t("لا توجد سنة مالية أو فترة صالحة.", "No fiscal year or valid period is available.")}</div> : <>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex gap-2 font-medium"><AlertTriangle size={18} />{t("الحركات غير المصنفة ظاهرة بوضوح ولا يتم تخمين تصنيفها.", "Unclassified movements are shown clearly and are never guessed.")}</div><p className="mt-1">{t("يُصنف التدفق من الحساب المقابل للنقد أو البنك في القيد المرحل.", "Cash flow is classified from the posted entry's account opposite the cash or bank line.")}</p></div>
        {report.configurationWarning ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{report.configurationWarning}</div> : <>
          <div className="grid gap-4 md:grid-cols-3"><div className="stat-card"><span>{t("رصيد النقد الافتتاحي", "Opening cash balance")}</span><strong className="number">{formatKWD(report.openingCash, numberLocale)}</strong></div><div className="stat-card"><span>{t("صافي حركة النقد", "Net cash movement")}</span><strong className="number">{formatKWD(report.netCashMovement, numberLocale)}</strong></div><div className="stat-card"><span>{t("رصيد النقد الختامي", "Closing cash balance")}</span><strong className="number">{formatKWD(report.closingCash, numberLocale)}</strong></div></div>
          <div className="grid gap-3 md:grid-cols-4"><div className="stat-card"><span>{t("تشغيلي", "Operating")}</span><strong className="number">{formatKWD(report.categories.OPERATING, numberLocale)}</strong></div><div className="stat-card"><span>{t("استثماري", "Investing")}</span><strong className="number">{formatKWD(report.categories.INVESTING, numberLocale)}</strong></div><div className="stat-card"><span>{t("تمويلي", "Financing")}</span><strong className="number">{formatKWD(report.categories.FINANCING, numberLocale)}</strong></div><div className="stat-card"><span>{t("غير مصنف", "Unclassified")}</span><strong className="number text-amber-700">{formatKWD(report.categories.NONE, numberLocale)}</strong></div></div>
          <div className="section-card text-sm"><p>{t("حسابات النقد والبنوك", "Cash and bank accounts")}: {report.accounts.map((account) => `${account.code} — ${en ? account.nameEn ?? account.nameAr : account.nameAr}`).join("، ")}</p><p className="mt-1">{t("إجمالي المقبوضات", "Total cash in")}: <span className="number">{formatKWD(report.totalCashIn, numberLocale)}</span> · {t("إجمالي المدفوعات", "Total cash out")}: <span className="number">{formatKWD(report.totalCashOut, numberLocale)}</span></p></div>
          <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="ar-table"><thead><tr><th>{t("التاريخ", "Date")}</th><th>{t("القيد", "Journal")}</th><th>{t("الحساب", "Account")}</th><th>{t("الوصف", "Description")}</th><th>{t("مقبوض", "Cash in")}</th><th>{t("مدفوع", "Cash out")}</th></tr></thead><tbody>{report.movements.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("لا توجد حركات نقدية في الفترة المحددة.", "No cash movements found for the selected period.")}</td></tr> : report.movements.map((movement) => <tr key={movement.lineId}><td>{movement.date.toLocaleDateString(numberLocale)}</td><td className="font-mono">{movement.journalNumber}</td><td>{movement.account.code} — {en ? movement.account.nameEn ?? movement.account.nameAr : movement.account.nameAr}</td><td>{en ? movement.descriptionEn ?? movement.descriptionAr : movement.descriptionAr}</td><td className="number text-green-700">{movement.cashIn ? movement.cashIn.toFixed(3) : "—"}</td><td className="number text-red-700">{movement.cashOut ? movement.cashOut.toFixed(3) : "—"}</td></tr>)}</tbody></table></div></div>
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle size={18}/>{t("رصيد الافتتاح + صافي الحركة = رصيد الختام.", "Opening cash + net movement = closing cash.")}</div>
        </>}
      </>}
    </main>
  </div>;
}
