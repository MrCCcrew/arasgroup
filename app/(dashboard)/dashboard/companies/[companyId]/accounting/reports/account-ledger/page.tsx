import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getAccountLedger } from "@/lib/accounting/reports";
import { PrintButton } from "@/components/ui/print-button";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    accountId?: string;
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
    fiscalYears.find((fy) => fy.isCurrent) ?? fiscalYears[0];

  const selectedFiscalYearId = sp.fiscalYearId ?? currentFiscalYear?.id;
  const selectedFiscalYear = fiscalYears.find((fy) => fy.id === selectedFiscalYearId);
  const selectedAccount = sp.accountId ? accounts.find((a) => a.id === sp.accountId) : null;

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
        title="حساب الأستاذ"
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
                الحساب <span className="text-destructive">*</span>
              </label>
              <select
                name="accountId"
                defaultValue={sp.accountId ?? ""}
                className="input-field"
                required
              >
                <option value="">— اختر حساباً —</option>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([type, label]) => {
                  const group = accounts.filter((a) => a.type === type);
                  if (!group.length) return null;
                  return (
                    <optgroup key={type} label={label}>
                      {group.map((a) => (
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

            {/* Submit */}
            <div className="flex items-end">
              <button
                type="submit"
                className="btn-primary w-full rounded-lg px-4 py-2 text-sm font-medium"
              >
                عرض
              </button>
            </div>

            {/* Date range */}
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
          </form>
        </div>

        {/* ── Placeholder when no account selected ── */}
        {!sp.accountId && (
          <div className="section-card py-16 text-center text-muted-foreground">
            اختر حساباً من القائمة أعلاه لعرض حركاته
          </div>
        )}

        {/* ── Results ── */}
        {sp.accountId && ledger && selectedAccount && (
          <>
            {/* Report header */}
            <div className="section-card space-y-1 text-center">
              <h2 className="text-xl font-bold">{company?.nameAr}</h2>
              <p className="text-muted-foreground">حساب الأستاذ</p>
              <p className="text-base font-semibold">
                {selectedAccount.code} — {selectedAccount.nameAr}
              </p>
              {selectedFiscalYear && (
                <p className="text-sm text-muted-foreground">
                  السنة المالية {selectedFiscalYear.year}
                </p>
              )}
              {(sp.startDate || sp.endDate) && (
                <p className="text-xs text-muted-foreground">
                  {sp.startDate ?? "—"} إلى {sp.endDate ?? "—"}
                </p>
              )}
            </div>

            {/* Ledger table */}
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="overflow-x-auto">
                <table className="ar-table text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="w-28">التاريخ</th>
                      <th className="w-28">رقم القيد</th>
                      <th>البيان</th>
                      <th className="w-28 text-start">مدين</th>
                      <th className="w-28 text-start">دائن</th>
                      <th className="w-28 text-start">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr className="bg-indigo-50/60 font-semibold text-indigo-700">
                      <td>—</td>
                      <td>—</td>
                      <td>الرصيد الافتتاحي</td>
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
                        {ledger.openingBalance.toFixed(3)}
                      </td>
                    </tr>

                    {ledger.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-10 text-center text-muted-foreground"
                        >
                          لا توجد حركات في هذه الفترة
                        </td>
                      </tr>
                    ) : (
                      ledger.rows.map((row, i) => (
                        <tr
                          key={row.lineId}
                          className={i % 2 === 0 ? "" : "bg-muted/5"}
                        >
                          <td className="number">
                            {new Date(row.date).toLocaleDateString("ar-KW")}
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
                            {row.balance.toFixed(3)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30 font-bold text-sm">
                    <tr>
                      <td colSpan={3} className="py-2 text-center">
                        الإجمالي
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
                        {ledger.closingBalance.toFixed(3)}
                      </td>
                    </tr>
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
