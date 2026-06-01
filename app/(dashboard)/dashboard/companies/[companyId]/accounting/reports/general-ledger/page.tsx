import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getLocale } from "@/lib/i18n";
import { PrintButton } from "@/components/ui/print-button";
import { GeneralLedgerClient } from "./GeneralLedgerClient";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    fiscalYearId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function GeneralLedgerPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const [company, fiscalYears] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true } }),
    prisma.fiscalYear.findMany({ where: { companyId }, orderBy: { year: "desc" } }),
  ]);

  const currentFiscalYear = fiscalYears.find((fy) => fy.isCurrent) ?? fiscalYears[0];
  const selectedFiscalYearId = sp.fiscalYearId ?? currentFiscalYear?.id;
  const selectedFiscalYear = fiscalYears.find((fy) => fy.id === selectedFiscalYearId);

  const start = sp.startDate ? new Date(sp.startDate) : undefined;
  const end = sp.endDate ? new Date(sp.endDate) : undefined;

  // ── Fast query: just totals per account (groupBy) ──
  const summaries = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        companyId,
        status: "POSTED",
        isDeleted: false,
        ...(selectedFiscalYearId ? { fiscalYearId: selectedFiscalYearId } : {}),
        ...(start || end
          ? { date: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } }
          : {}),
      },
    },
    _sum: { debit: true, credit: true },
    _count: { _all: true },
  });

  // ── Fetch account names for those IDs ──
  const accountIds = summaries.map((s) => s.accountId);
  const accounts = await prisma.chartOfAccount.findMany({
    where: { id: { in: accountIds } },
    select: { id: true, code: true, nameAr: true, type: true },
    orderBy: { code: "asc" },
  });
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const accountData = summaries
    .map((s) => {
      const acc = accountMap.get(s.accountId);
      if (!acc) return null;
      const totalDebit = Number(s._sum.debit ?? 0);
      const totalCredit = Number(s._sum.credit ?? 0);
      return {
        accountId: s.accountId,
        code: acc.code,
        nameAr: acc.nameAr,
        type: acc.type,
        totalDebit,
        totalCredit,
        closingBalance: totalDebit - totalCredit,
        lineCount: s._count._all,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.code.localeCompare(b!.code)) as {
    accountId: string;
    code: string;
    nameAr: string;
    type: string;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    lineCount: number;
  }[];

  const grandTotalDebit = accountData.reduce((s, a) => s + a.totalDebit, 0);
  const grandTotalCredit = accountData.reduce((s, a) => s + a.totalCredit, 0);

  const en = (await getLocale()) === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const allPeriods = en ? "All periods" : "كل الفترات";
  const t = {
    title: en ? "General Ledger" : "دفتر الأستاذ العام",
    fiscalYear: en ? "Fiscal year" : "السنة المالية",
    allPeriodsOpt: en ? "— All periods —" : "— كل الفترات —",
    from: en ? "From date" : "من تاريخ",
    to: en ? "To date" : "إلى تاريخ",
    show: en ? "Show" : "عرض",
    forYear: en ? "Fiscal year" : "السنة المالية",
    toWord: en ? "to" : "إلى",
    empty: en ? "No posted entries in this period" : "لا توجد قيود مرحّلة في هذه الفترة",
  };

  return (
    <div>
      <Header
        title={t.title}
        subtitle={`${company?.nameAr ?? ""} — ${selectedFiscalYear?.year ?? allPeriods}`}
        companyId={companyId}
        actions={<PrintButton />}
      />

      <div className="page-container">
        {/* ── Filters ── */}
        <div className="section-card no-print">
          <form method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="form-label">{t.fiscalYear}</label>
              <select
                name="fiscalYearId"
                defaultValue={selectedFiscalYearId ?? ""}
                className="input-field"
              >
                <option value="">{t.allPeriodsOpt}</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">{t.from}</label>
              <input
                type="date"
                name="startDate"
                defaultValue={sp.startDate ?? ""}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">{t.to}</label>
              <input
                type="date"
                name="endDate"
                defaultValue={sp.endDate ?? ""}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full rounded-lg px-4 py-2 text-sm font-medium">
                {t.show}
              </button>
            </div>
          </form>
        </div>

        {/* ── Report header ── */}
        <div className="section-card space-y-1 text-center">
          <h2 className="text-xl font-bold">{company?.nameAr}</h2>
          <p className="text-muted-foreground">{t.title}</p>
          {selectedFiscalYear ? (
            <p className="text-sm text-muted-foreground">
              {t.forYear} {selectedFiscalYear.year}&nbsp;|&nbsp;
              {selectedFiscalYear.startDate?.toLocaleDateString(numberLocale)} —{" "}
              {selectedFiscalYear.endDate?.toLocaleDateString(numberLocale)}
            </p>
          ) : (sp.startDate || sp.endDate) ? (
            <p className="text-sm text-muted-foreground">
              {sp.startDate ?? "—"} {t.toWord} {sp.endDate ?? "—"}
            </p>
          ) : null}
        </div>

        {accountData.length === 0 ? (
          <div className="section-card py-16 text-center text-muted-foreground">
            {t.empty}
          </div>
        ) : (
          <GeneralLedgerClient
            accounts={accountData}
            companyId={companyId}
            fiscalYearId={selectedFiscalYearId}
            startDate={sp.startDate}
            endDate={sp.endDate}
            grandTotalDebit={grandTotalDebit}
            grandTotalCredit={grandTotalCredit}
            locale={en ? "en" : "ar"}
          />
        )}
      </div>
    </div>
  );
}
