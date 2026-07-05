import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ investorId?: string; year?: string; view?: string }>;
}

type Row = { id: string; name: string; due: number; paid: number; remaining: number };

export default async function ManagersReportsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const en = (await getLocale()) === "en";
  const nl = en ? "en-US" : "ar-KW";
  const money = (n: number) => `${n.toLocaleString(nl, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${en ? "KWD" : "د.ك"}`;
  const year = sp.year ? Number(sp.year) : undefined;
  const investorId = sp.investorId || undefined;
  const view = sp.view || "";
  const show = (v: string) => !view || view === v;

  const [investors, charges, batches] = await Promise.all([
    prisma.investor.findMany({ where: { companies: { some: { id: companyId } } }, select: { id: true, nameAr: true }, orderBy: { nameAr: "asc" } }),
    prisma.managerCharge.findMany({
      where: { companyId, ...(investorId ? { investorId } : {}), ...(year ? { year } : {}) },
      include: { investor: { select: { nameAr: true } }, payments: { select: { amount: true } } },
    }),
    prisma.managerSalaryBatch.findMany({
      where: { companyId, ...(investorId ? { investorId } : {}), ...(year ? { year } : {}) },
      include: {
        investor: { select: { nameAr: true } },
        lines: { include: { employee: { select: { nameAr: true } } } },
        payments: { select: { amount: true } },
      },
    }),
  ]);

  type InvestorRow = typeof investors[number];
  type ChargeRow = typeof charges[number];
  type ChargePaymentRow = ChargeRow["payments"][number];
  type BatchRow = typeof batches[number];
  type BatchLineRow = BatchRow["lines"][number];
  type BatchPaymentRow = BatchRow["payments"][number];

  // كشوف لكل مسئول حسب النوع
  function chargeRows(type: string): { rows: Row[]; totals: Row } {
    const map = new Map<string, Row>();
    for (const c of charges.filter((x: ChargeRow) => x.type === type)) {
      const due = Number(c.amount);
      const paid = c.payments.reduce((s: number, p: ChargePaymentRow) => s + Number(p.amount), 0);
      const r = map.get(c.investorId) ?? { id: c.investorId, name: c.investor.nameAr, due: 0, paid: 0, remaining: 0 };
      r.due += due; r.paid += paid; r.remaining += due - paid;
      map.set(c.investorId, r);
    }
    const rows = [...map.values()].sort((a, b) => b.remaining - a.remaining);
    const totals = rows.reduce((t: Row, r: Row) => ({ id: "", name: "", due: t.due + r.due, paid: t.paid + r.paid, remaining: t.remaining + r.remaining }), { id: "", name: "", due: 0, paid: 0, remaining: 0 });
    return { rows, totals };
  }

  // كشف الرواتب لكل مسئول
  const salaryMap = new Map<string, Row>();
  for (const b of batches) {
    const due = b.lines.reduce((s: number, l: BatchLineRow) => s + Number(l.amount), 0) + Number(b.bankCommission);
    const paid = b.payments.reduce((s: number, p: BatchPaymentRow) => s + Number(p.amount), 0);
    const r = salaryMap.get(b.investorId) ?? { id: b.investorId, name: b.investor.nameAr, due: 0, paid: 0, remaining: 0 };
    r.due += due; r.paid += paid; r.remaining += due - paid;
    salaryMap.set(b.investorId, r);
  }
  const salaryRows = [...salaryMap.values()].sort((a, b) => b.remaining - a.remaining);
  const salaryTotals = salaryRows.reduce((t: { due: number; paid: number; remaining: number }, r: Row) => ({ due: t.due + r.due, paid: t.paid + r.paid, remaining: t.remaining + r.remaining }), { due: 0, paid: 0, remaining: 0 });

  // كشف لكل موظف (إجمالي رواتبه المسجّلة عبر الدفعات)
  const empMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of batches) for (const l of b.lines) {
    const e = empMap.get(l.employeeId) ?? { name: l.employee.nameAr, total: 0, count: 0 };
    e.total += Number(l.amount); e.count += 1; empMap.set(l.employeeId, e);
  }
  const empRows = [...empMap.values()].sort((a, b) => b.total - a.total);

  const rent = chargeRows("RENT");
  const expense = chargeRows("EXPENSE");
  const revenue = chargeRows("REVENUE");

  const sectionTable = (titleAr: string, titleEn: string, data: { rows: Row[]; totals: Row }) => (
    <div className="overflow-hidden rounded-xl border bg-card">
      <p className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">{en ? titleEn : titleAr}</p>
      <table className="ar-table text-sm">
        <thead><tr><th>{en ? "Official" : "المسئول"}</th><th className="text-end">{en ? "Due" : "المستحق"}</th><th className="text-end">{en ? "Paid" : "المدفوع"}</th><th className="text-end">{en ? "Remaining" : "المتبقي"}</th></tr></thead>
        <tbody>
          {data.rows.length === 0 ? (
            <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">—</td></tr>
          ) : data.rows.map((r) => (
            <tr key={r.id}><td className="font-medium">{r.name}</td><td className="number text-end">{money(r.due)}</td><td className="number text-end text-emerald-600">{money(r.paid)}</td><td className={`number text-end font-bold ${r.remaining > 0.0005 ? "text-red-600" : "text-emerald-600"}`}>{money(r.remaining)}</td></tr>
          ))}
        </tbody>
        {data.rows.length > 0 && (
          <tfoot><tr className="border-t-2 bg-muted/30 font-bold"><td>{en ? "Total" : "الإجمالي"}</td><td className="number text-end">{money(data.totals.due)}</td><td className="number text-end text-emerald-600">{money(data.totals.paid)}</td><td className="number text-end text-red-600">{money(data.totals.remaining)}</td></tr></tfoot>
        )}
      </table>
    </div>
  );

  return (
    <div>
      <Header
        title={en ? "Officials reports" : "تقارير المسئولين"}
        subtitle={en ? "Due / paid / remaining statements — reference only" : "كشوف المستحق/المدفوع/المتبقي — مرجعي فقط"}
        companyId={companyId}
      />
      <div className="page-container space-y-4">
        <Link href={`/dashboard/companies/${companyId}/managers`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight size={16} /> {en ? "Back" : "العودة"}
        </Link>

        <form method="GET" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Official" : "المسئول"}</label>
            <select name="investorId" defaultValue={investorId ?? ""} className="input-field w-full sm:w-64">
              <option value="">{en ? "All officials" : "كل المسئولين"}</option>
              {investors.map((i: InvestorRow) => (<option key={i.id} value={i.id}>{i.nameAr}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Year" : "السنة"}</label>
            <input type="number" name="year" defaultValue={sp.year ?? ""} className="input-field w-28" dir="ltr" placeholder={en ? "All" : "الكل"} />
          </div>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">{en ? "Filter" : "تصفية"}</button>
          {(investorId || sp.year) && (
            <Link href={`/dashboard/companies/${companyId}/managers/reports`} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">{en ? "Clear" : "مسح"}</Link>
          )}
        </form>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {show("rents") && sectionTable("كشف الإيجارات", "Rents statement", rent)}
          {show("expenses") && sectionTable("كشف المصاريف", "Expenses statement", expense)}
          {show("revenue") && sectionTable("كشف الإيرادات", "Revenue statement", revenue)}
          {show("salaries") && sectionTable("كشف الرواتب", "Salaries statement", { rows: salaryRows, totals: { id: "", name: "", ...salaryTotals } })}
        </div>

        {/* كشف لكل موظف */}
        {show("employees") && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <p className="border-b bg-muted/40 px-3 py-2 text-sm font-bold">{en ? "By employee (recorded salaries)" : "كشف لكل موظف (الرواتب المسجّلة)"}</p>
          <table className="ar-table text-sm">
            <thead><tr><th>{en ? "Employee" : "الموظف"}</th><th className="text-center">{en ? "Months" : "عدد الأشهر"}</th><th className="text-end">{en ? "Total salaries" : "إجمالي الرواتب"}</th></tr></thead>
            <tbody>
              {empRows.length === 0 ? (
                <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">—</td></tr>
              ) : empRows.map((e, i: number) => (
                <tr key={i}><td className="font-medium">{e.name}</td><td className="number text-center">{e.count}</td><td className="number text-end font-bold">{money(e.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
