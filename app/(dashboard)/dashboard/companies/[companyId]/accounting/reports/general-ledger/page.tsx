import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getFullGeneralLedger } from "@/lib/accounting/reports";
import { PrintButton } from "@/components/ui/print-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    fiscalYearId?: string;
    startDate?: string;
    endDate?: string;
  }>;
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: "أصول",
  LIABILITY: "خصوم",
  EQUITY: "حقوق الملكية",
  REVENUE: "إيرادات",
  EXPENSE: "مصروفات",
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: "bg-blue-50 text-blue-800 border-blue-200",
  LIABILITY: "bg-red-50 text-red-800 border-red-200",
  EQUITY: "bg-purple-50 text-purple-800 border-purple-200",
  REVENUE: "bg-green-50 text-green-800 border-green-200",
  EXPENSE: "bg-orange-50 text-orange-800 border-orange-200",
};

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

  const ledger = await getFullGeneralLedger(
    companyId,
    selectedFiscalYearId,
    sp.startDate ? new Date(sp.startDate) : undefined,
    sp.endDate ? new Date(sp.endDate) : undefined,
  );

  const grandTotalDebit = ledger.reduce((s, a) => s + a.totalDebit, 0);
  const grandTotalCredit = ledger.reduce((s, a) => s + a.totalCredit, 0);

  return (
    <div>
      <Header
        title="دفتر الأستاذ العام"
        subtitle={`${company?.nameAr} — ${selectedFiscalYear?.year ?? "كل الفترات"}`}
        companyId={companyId}
        actions={<PrintButton />}
      />

      <div className="page-container">
        {/* ── Filters ── */}
        <div className="section-card no-print">
          <form
            method="GET"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div>
              <label className="form-label">السنة المالية</label>
              <select
                name="fiscalYearId"
                defaultValue={selectedFiscalYearId ?? ""}
                className="input-field"
              >
                <option value="">— كل الفترات —</option>
                {fiscalYears.map((fy) => (
                  <option key={fy.id} value={fy.id}>
                    {fy.year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">من تاريخ</label>
              <input
                type="date"
                name="startDate"
                defaultValue={sp.startDate ?? ""}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">إلى تاريخ</label>
              <input
                type="date"
                name="endDate"
                defaultValue={sp.endDate ?? ""}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="btn-primary w-full rounded-lg px-4 py-2 text-sm font-medium"
              >
                عرض
              </button>
            </div>
          </form>
        </div>

        {/* ── Report header ── */}
        <div className="section-card space-y-1 text-center">
          <h2 className="text-xl font-bold">{company?.nameAr}</h2>
          <p className="text-muted-foreground">دفتر الأستاذ العام</p>
          {selectedFiscalYear ? (
            <p className="text-sm text-muted-foreground">
              السنة المالية {selectedFiscalYear.year} &nbsp;|&nbsp;{" "}
              {selectedFiscalYear.startDate?.toLocaleDateString("ar-KW")} —{" "}
              {selectedFiscalYear.endDate?.toLocaleDateString("ar-KW")}
            </p>
          ) : (sp.startDate || sp.endDate) ? (
            <p className="text-sm text-muted-foreground">
              {sp.startDate ?? "—"} إلى {sp.endDate ?? "—"}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            إجمالي الحسابات: {ledger.length}
          </p>
        </div>

        {/* ── No data ── */}
        {ledger.length === 0 && (
          <div className="section-card py-16 text-center text-muted-foreground">
            لا توجد قيود مرحّلة في هذه الفترة
          </div>
        )}

        {/* ── Account sections ── */}
        {ledger.map((accountData) => {
          const colorClass =
            ACCOUNT_TYPE_COLORS[accountData.account.type] ??
            "bg-muted text-foreground border-border";
          return (
            <div
              key={accountData.account.id}
              className="overflow-hidden rounded-xl border bg-card"
            >
              {/* Account header */}
              <div
                className={`flex items-center justify-between border-b px-4 py-2.5 text-sm font-bold ${colorClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono">{accountData.account.code}</span>
                  <span>{accountData.account.nameAr}</span>
                  <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-normal">
                    {ACCOUNT_TYPE_LABELS[accountData.account.type] ?? accountData.account.type}
                  </span>
                </div>
                <div className="flex gap-6 text-xs">
                  <span>
                    مدين:{" "}
                    <span className="font-mono">
                      {accountData.totalDebit.toFixed(3)}
                    </span>
                  </span>
                  <span>
                    دائن:{" "}
                    <span className="font-mono">
                      {accountData.totalCredit.toFixed(3)}
                    </span>
                  </span>
                  <span
                    className={
                      accountData.closingBalance >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }
                  >
                    رصيد:{" "}
                    <span className="font-mono">
                      {accountData.closingBalance.toFixed(3)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Lines table */}
              <div className="overflow-x-auto">
                <table className="ar-table text-xs">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="w-28">التاريخ</th>
                      <th className="w-28">رقم القيد</th>
                      <th>البيان</th>
                      <th className="w-28 text-start">مدين</th>
                      <th className="w-28 text-start">دائن</th>
                      <th className="w-28 text-start">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountData.lines.map((line, i) => (
                      <tr
                        key={line.lineId}
                        className={i % 2 === 0 ? "" : "bg-muted/5"}
                      >
                        <td className="number">
                          {new Date(line.date).toLocaleDateString("ar-KW")}
                        </td>
                        <td className="font-mono">{line.journalNumber}</td>
                        <td>{line.description ?? "—"}</td>
                        <td className="number text-start text-blue-600">
                          {line.debit > 0 ? line.debit.toFixed(3) : "—"}
                        </td>
                        <td className="number text-start text-green-600">
                          {line.credit > 0 ? line.credit.toFixed(3) : "—"}
                        </td>
                        <td
                          className={`number text-start font-semibold ${
                            line.balance >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          {line.balance.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-border bg-muted/20 font-bold">
                    <tr>
                      <td colSpan={3} className="py-1.5 text-center text-xs">
                        إجمالي الحساب
                      </td>
                      <td className="number text-start text-blue-600">
                        {accountData.totalDebit.toFixed(3)}
                      </td>
                      <td className="number text-start text-green-600">
                        {accountData.totalCredit.toFixed(3)}
                      </td>
                      <td
                        className={`number text-start ${
                          accountData.closingBalance >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {accountData.closingBalance.toFixed(3)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}

        {/* ── Grand total ── */}
        {ledger.length > 0 && (
          <div className="rounded-xl border-2 border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold">الإجمالي العام</span>
              <div className="flex gap-8 text-sm font-bold">
                <span>
                  إجمالي المدين:{" "}
                  <span className="number text-blue-600">
                    {grandTotalDebit.toFixed(3)} د.ك
                  </span>
                </span>
                <span>
                  إجمالي الدائن:{" "}
                  <span className="number text-green-600">
                    {grandTotalCredit.toFixed(3)} د.ك
                  </span>
                </span>
                <span
                  className={
                    Math.abs(grandTotalDebit - grandTotalCredit) < 0.001
                      ? "text-emerald-600"
                      : "text-red-600"
                  }
                >
                  {Math.abs(grandTotalDebit - grandTotalCredit) < 0.001
                    ? "✓ الدفتر متوازن"
                    : `✗ فرق: ${Math.abs(grandTotalDebit - grandTotalCredit).toFixed(3)}`}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
