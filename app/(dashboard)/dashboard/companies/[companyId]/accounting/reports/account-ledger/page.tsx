import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getAccountLedger } from "@/lib/accounting/reports";
import { getLocale } from "@/lib/i18n";
import { PrintButton } from "@/components/ui/print-button";
import { formatSignedBalance, formatSignedBalanceEn } from "@/lib/accounting/balance-format";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    accountId?: string;
    fiscalYearId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

const ACCOUNT_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  ASSET: { ar: "أصول", en: "Assets" },
  LIABILITY: { ar: "خصوم", en: "Liabilities" },
  EQUITY: { ar: "حقوق الملكية", en: "Equity" },
  REVENUE: { ar: "إيرادات", en: "Revenue" },
  EXPENSE: { ar: "مصروفات", en: "Expenses" },
};

export default async function AccountLedgerPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const [company, accounts, fiscalYears] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true } }),
    prisma.chartOfAccount.findMany({
      where: { companyId, isActive: true, isHeader: false },
      orderBy: { code: "asc" },
      select: { id: true, code: true, nameAr: true, type: true },
    }),
    prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { year: "desc" },
    }),
  ]);

  const currentFiscalYear =
    fiscalYears.find((fy: typeof fiscalYears[number]) => fy.isCurrent) ?? fiscalYears[0];

  const selectedFiscalYearId = sp.fiscalYearId ?? currentFiscalYear?.id;
  const selectedFiscalYear = fiscalYears.find((fy: typeof fiscalYears[number]) => fy.id === selectedFiscalYearId);
  const selectedAccount = sp.accountId ? accounts.find((a: typeof accounts[number]) => a.id === sp.accountId) : null;

  const en = (await getLocale()) === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    title: en ? "Account Ledger" : "حساب الأستاذ",
    account: en ? "Account" : "الحساب",
    chooseAccount: en ? "— Select an account —" : "— اختر حساباً —",
    fiscalYear: en ? "Fiscal year" : "السنة المالية",
    allPeriods: en ? "— All periods —" : "— كل الفترات —",
    show: en ? "Show" : "عرض",
    from: en ? "From date" : "من تاريخ",
    to: en ? "To date" : "إلى تاريخ",
    placeholder: en ? "Select an account above to view its movements" : "اختر حساباً من القائمة أعلاه لعرض حركاته",
    forYear: en ? "Fiscal year" : "السنة المالية",
    toWord: en ? "to" : "إلى",
    date: en ? "Date" : "التاريخ",
    entryNo: en ? "Entry no." : "رقم القيد",
    statement: en ? "Statement" : "البيان",
    debit: en ? "Debit" : "مدين",
    credit: en ? "Credit" : "دائن",
    balance: en ? "Balance" : "الرصيد",
    opening: en ? "Opening balance" : "الرصيد الافتتاحي",
    noMovements: en ? "No movements in this period" : "لا توجد حركات في هذه الفترة",
    total: en ? "Total" : "الإجمالي",
  };

  let ledger: Awaited<ReturnType<typeof getAccountLedger>> | null = null;
  if (sp.accountId) {
    ledger = await getAccountLedger(
      companyId,
      sp.accountId,
      selectedFiscalYearId,
      sp.startDate ? new Date(sp.startDate) : undefined,
      sp.endDate ? new Date(sp.endDate) : undefined,
    );
  }

  return (
    <div>
      <Header
        title={t.title}
        subtitle={company?.nameAr}
        companyId={companyId}
        actions={ledger ? <PrintButton /> : undefined}
      />

      <div className="page-container">
        {/* ── Filters ── */}
        <div className="section-card no-print">
          <form method="GET" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Account */}
            <div className="sm:col-span-2">
              <label className="form-label">
                {t.account} <span className="text-destructive">*</span>
              </label>
              <select
                name="accountId"
                defaultValue={sp.accountId ?? ""}
                className="input-field"
                required
              >
                <option value="">{t.chooseAccount}</option>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([type, label]) => {
                  const group = accounts.filter((a: typeof accounts[number]) => a.type === type);
                  if (!group.length) return null;
                  return (
                    <optgroup key={type} label={en ? label.en : label.ar}>
                      {group.map((a: typeof accounts[number]) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.nameAr}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>

            {/* Fiscal year */}
            <div>
              <label className="form-label">{t.fiscalYear}</label>
              <select
                name="fiscalYearId"
                defaultValue={selectedFiscalYearId ?? ""}
                className="input-field"
              >
                <option value="">{t.allPeriods}</option>
                {fiscalYears.map((fy: typeof fiscalYears[number]) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.year}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                className="btn-primary w-full rounded-lg px-4 py-2 text-sm font-medium"
              >
                {t.show}
              </button>
            </div>

            {/* Date range */}
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
          </form>
        </div>

        {/* ── Placeholder when no account selected ── */}
        {!sp.accountId && (
          <div className="section-card py-16 text-center text-muted-foreground">
            {t.placeholder}
          </div>
        )}

        {/* ── Results ── */}
        {sp.accountId && ledger && selectedAccount && (
          <>
            {/* Report header */}
            <div className="section-card space-y-1 text-center">
              <h2 className="text-xl font-bold">{company?.nameAr}</h2>
              <p className="text-muted-foreground">{t.title}</p>
              <p className="text-base font-semibold">
                {selectedAccount.code} — {selectedAccount.nameAr}
              </p>
              {selectedFiscalYear && (
                <p className="text-sm text-muted-foreground">
                  {t.forYear} {selectedFiscalYear.year}
                </p>
              )}
              {(sp.startDate || sp.endDate) && (
                <p className="text-xs text-muted-foreground">
                  {sp.startDate ?? "—"} {t.toWord} {sp.endDate ?? "—"}
                </p>
              )}
            </div>

            {/* Ledger table */}
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="ar-table text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="w-28">{t.date}</th>
                      <th className="w-28">{t.entryNo}</th>
                      <th>{t.statement}</th>
                      <th className="w-28 text-start">{t.debit}</th>
                      <th className="w-28 text-start">{t.credit}</th>
                      <th className="w-28 text-start">{t.balance}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    {(() => {
                      const formattedOpening = en
                        ? formatSignedBalanceEn(ledger.openingBalance)
                        : formatSignedBalance(ledger.openingBalance);
                      return (
                        <tr className="bg-indigo-50/60 font-semibold text-indigo-700">
                          <td>—</td>
                          <td>—</td>
                          <td>{t.opening}</td>
                          <td className="number text-start">
                            {ledger.openingBalance > 0
                              ? ledger.openingBalance.toFixed(3)
                              : "—"}
                          </td>
                          <td className="number text-start">
                            {ledger.openingBalance < 0
                              ? Math.abs(ledger.openingBalance).toFixed(3)
                              : "—"}
                          </td>
                          <td
                            className={`number text-start font-bold ${
                              ledger.openingBalance >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {formattedOpening.formatted}
                          </td>
                        </tr>
                      );
                    })()}

                    {ledger.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-muted-foreground"
                        >
                          {t.noMovements}
                        </td>
                      </tr>
                    ) : (
                      ledger.rows.map((row: typeof ledger.rows[number], i: number) => {
                        const formattedBalance = en
                          ? formatSignedBalanceEn(row.balance)
                          : formatSignedBalance(row.balance);
                        return (
                          <tr
                            key={row.lineId}
                            className={i % 2 === 0 ? "" : "bg-muted/5"}
                          >
                            <td className="number">
                              {new Date(row.date).toLocaleDateString(numberLocale)}
                            </td>
                            <td className="font-mono text-xs">{row.journalNumber}</td>
                            <td>{row.description ?? "—"}</td>
                            <td className="number text-start text-blue-600">
                              {row.debit > 0 ? row.debit.toFixed(3) : "—"}
                            </td>
                            <td className="number text-start text-green-600">
                              {row.credit > 0 ? row.credit.toFixed(3) : "—"}
                            </td>
                            <td
                              className={`number text-start font-bold ${
                                row.balance >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formattedBalance.formatted}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30 font-bold text-sm">
                    {(() => {
                      const formattedClosing = en
                        ? formatSignedBalanceEn(ledger.closingBalance)
                        : formatSignedBalance(ledger.closingBalance);
                      return (
                        <tr>
                          <td colSpan={3} className="py-2 text-center">
                            {t.total}
                          </td>
                          <td className="number text-start text-blue-600">
                            {ledger.totalDebit.toFixed(3)}
                          </td>
                          <td className="number text-start text-green-600">
                            {ledger.totalCredit.toFixed(3)}
                          </td>
                          <td
                            className={`number text-start ${
                              ledger.closingBalance >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {formattedClosing.formatted}
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
