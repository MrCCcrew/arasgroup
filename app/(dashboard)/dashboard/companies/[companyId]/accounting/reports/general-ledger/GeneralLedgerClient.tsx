"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCOUNT_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  ASSET: { ar: "أصول", en: "Assets" },
  LIABILITY: { ar: "خصوم", en: "Liabilities" },
  EQUITY: { ar: "حقوق الملكية", en: "Equity" },
  REVENUE: { ar: "إيرادات", en: "Revenue" },
  EXPENSE: { ar: "مصروفات", en: "Expenses" },
};

const ACCOUNT_TYPE_COLORS: Record<string, { header: string; badge: string }> = {
  ASSET:     { header: "bg-blue-50   border-blue-200   text-blue-800",   badge: "bg-blue-100   text-blue-700"   },
  LIABILITY: { header: "bg-red-50    border-red-200    text-red-800",    badge: "bg-red-100    text-red-700"    },
  EQUITY:    { header: "bg-purple-50 border-purple-200 text-purple-800", badge: "bg-purple-100 text-purple-700" },
  REVENUE:   { header: "bg-green-50  border-green-200  text-green-800",  badge: "bg-green-100  text-green-700"  },
  EXPENSE:   { header: "bg-orange-50 border-orange-200 text-orange-800", badge: "bg-orange-100 text-orange-700" },
};

type AccountSummary = {
  accountId: string;
  code: string;
  nameAr: string;
  type: string;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  lineCount: number;
};

type LedgerLine = {
  lineId: string;
  journalNumber: string;
  date: string;
  description: string | null;
  type: string;
  debit: number;
  credit: number;
  balance: number;
};

interface Props {
  accounts: AccountSummary[];
  companyId: string;
  fiscalYearId?: string;
  startDate?: string;
  endDate?: string;
  grandTotalDebit: number;
  grandTotalCredit: number;
  locale?: "ar" | "en";
}

export function GeneralLedgerClient({
  accounts,
  companyId,
  fiscalYearId,
  startDate,
  endDate,
  grandTotalDebit,
  grandTotalCredit,
  locale = "ar",
}: Props) {
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    accountsHint: (n: number) => (en ? `${n} account(s)  |  click any account to view its movements` : `${n} حساب  |  انقر على أي حساب لعرض حركاته`),
    expandAll: en ? "Expand all" : "فتح الكل",
    collapseAll: en ? "Collapse all" : "طي الكل",
    lines: (n: number) => (en ? `${n} line(s)` : `${n} سطر`),
    debit: en ? "Debit" : "مدين",
    credit: en ? "Credit" : "دائن",
    balance: en ? "Balance" : "رصيد",
    loading: en ? "Loading..." : "جاري التحميل...",
    noMovements: en ? "No movements in this period" : "لا توجد حركات في هذه الفترة",
    date: en ? "Date" : "التاريخ",
    entryNo: en ? "Entry no." : "رقم القيد",
    statement: en ? "Statement" : "البيان",
    accountTotal: en ? "Account total" : "إجمالي الحساب",
    grandTotal: en ? "Grand total" : "الإجمالي العام",
    totalDebit: en ? "Total debit:" : "إجمالي المدين:",
    totalCredit: en ? "Total credit:" : "إجمالي الدائن:",
    kwd: en ? "KWD" : "د.ك",
    balanced: en ? "✓ The ledger is balanced" : "✓ الدفتر متوازن",
    diff: (d: string) => (en ? `✗ Difference: ${d}` : `✗ فرق: ${d}`),
  };
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [linesCache, setLinesCache] = useState<Record<string, LedgerLine[]>>({});
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set());

  const fetchLines = useCallback(
    async (accountId: string) => {
      if (linesCache[accountId]) return;
      setLoadingSet((prev) => new Set([...prev, accountId]));
      try {
        const params = new URLSearchParams({ type: "ledger", companyId, accountId });
        if (fiscalYearId) params.set("fiscalYearId", fiscalYearId);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/accounting/reports?${params}`);
        const json = await res.json();
        if (json.success) {
          setLinesCache((prev) => ({ ...prev, [accountId]: json.data.rows ?? json.data }));
        }
      } finally {
        setLoadingSet((prev) => {
          const s = new Set(prev);
          s.delete(accountId);
          return s;
        });
      }
    },
    [companyId, fiscalYearId, startDate, endDate, linesCache],
  );

  function toggle(accountId: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      if (s.has(accountId)) {
        s.delete(accountId);
      } else {
        s.add(accountId);
        fetchLines(accountId);
      }
      return s;
    });
  }

  function expandAll() {
    const allIds = new Set(accounts.map((a) => a.accountId));
    setExpanded(allIds);
    accounts.forEach((a) => fetchLines(a.accountId));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.001;

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="no-print flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t.accountsHint(accounts.length)}
        </p>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
          >
            {t.expandAll}
          </button>
          <button
            onClick={collapseAll}
            className="rounded-lg border px-3 py-1.5 text-xs hover:bg-muted"
          >
            {t.collapseAll}
          </button>
        </div>
      </div>

      {/* ── Account list ── */}
      {accounts.map((acc) => {
        const isOpen = expanded.has(acc.accountId);
        const isLoading = loadingSet.has(acc.accountId);
        const lines = linesCache[acc.accountId];
        const colors = ACCOUNT_TYPE_COLORS[acc.type] ?? {
          header: "bg-muted border-border text-foreground",
          badge: "bg-muted text-muted-foreground",
        };

        return (
          <div key={acc.accountId} className="overflow-hidden rounded-xl border bg-card">
            {/* Account header row — clickable */}
            <button
              onClick={() => toggle(acc.accountId)}
              className={cn(
                "flex w-full items-center justify-between border-b px-4 py-2.5 text-sm transition-colors",
                colors.header,
                "hover:brightness-95",
              )}
            >
              {/* Left: code + name + type badge */}
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown size={15} className="shrink-0 opacity-60" />
                ) : (
                  <ChevronLeft size={15} className="shrink-0 opacity-60" />
                )}
                <span className="font-mono font-semibold">{acc.code}</span>
                <span className="font-bold">{acc.nameAr}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-normal", colors.badge)}>
                  {(ACCOUNT_TYPE_LABELS[acc.type] && (en ? ACCOUNT_TYPE_LABELS[acc.type].en : ACCOUNT_TYPE_LABELS[acc.type].ar)) ?? acc.type}
                </span>
                <span className="text-xs opacity-60">{t.lines(acc.lineCount)}</span>
              </div>

              {/* Right: totals summary */}
              <div className="flex gap-5 text-xs font-medium">
                <span>
                  {t.debit}:{" "}
                  <span className="number font-mono text-blue-700">
                    {acc.totalDebit.toFixed(3)}
                  </span>
                </span>
                <span>
                  {t.credit}:{" "}
                  <span className="number font-mono text-green-700">
                    {acc.totalCredit.toFixed(3)}
                  </span>
                </span>
                <span>
                  {t.balance}:{" "}
                  <span
                    className={cn(
                      "number font-mono font-bold",
                      acc.closingBalance >= 0 ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {acc.closingBalance.toFixed(3)}
                  </span>
                </span>
              </div>
            </button>

            {/* Lines table — shown when expanded */}
            {isOpen && (
              <div className="overflow-x-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" />
                    {t.loading}
                  </div>
                ) : !lines || lines.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t.noMovements}
                  </p>
                ) : (
                  <table className="ar-table text-xs">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="w-28">{t.date}</th>
                        <th className="w-28">{t.entryNo}</th>
                        <th>{t.statement}</th>
                        <th className="w-28 text-start">{t.debit}</th>
                        <th className="w-28 text-start">{t.credit}</th>
                        <th className="w-28 text-start">{t.balance}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={line.lineId} className={i % 2 === 0 ? "" : "bg-muted/5"}>
                          <td className="number">
                            {new Date(line.date).toLocaleDateString(numberLocale)}
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
                            className={cn(
                              "number text-start font-semibold",
                              line.balance >= 0 ? "text-emerald-600" : "text-red-600",
                            )}
                          >
                            {line.balance.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t border-border bg-muted/20 font-bold">
                      <tr>
                        <td colSpan={3} className="py-1.5 text-center text-xs">
                          {t.accountTotal}
                        </td>
                        <td className="number text-start text-blue-600">
                          {acc.totalDebit.toFixed(3)}
                        </td>
                        <td className="number text-start text-green-600">
                          {acc.totalCredit.toFixed(3)}
                        </td>
                        <td
                          className={cn(
                            "number text-start",
                            acc.closingBalance >= 0 ? "text-emerald-600" : "text-red-600",
                          )}
                        >
                          {acc.closingBalance.toFixed(3)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Grand total ── */}
      {accounts.length > 0 && (
        <div className="rounded-xl border-2 border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-base font-bold">{t.grandTotal}</span>
            <div className="flex flex-wrap gap-6 text-sm font-bold">
              <span>
                {t.totalDebit}{" "}
                <span className="number text-blue-600">
                  {grandTotalDebit.toFixed(3)} {t.kwd}
                </span>
              </span>
              <span>
                {t.totalCredit}{" "}
                <span className="number text-green-600">
                  {grandTotalCredit.toFixed(3)} {t.kwd}
                </span>
              </span>
              <span className={isBalanced ? "text-emerald-600" : "text-red-600"}>
                {isBalanced
                  ? t.balanced
                  : t.diff(Math.abs(grandTotalDebit - grandTotalCredit).toFixed(3))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
