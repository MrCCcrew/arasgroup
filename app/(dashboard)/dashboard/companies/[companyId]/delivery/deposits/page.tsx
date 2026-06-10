import { redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ driverId?: string; from?: string; to?: string }>;
}

export default async function DriverDepositsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";

  // نطاق التواريخ (اختياري) — to شامل لليوم بالكامل
  const fromDate = sp.from ? new Date(sp.from) : undefined;
  const toDate = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;

  const where = {
    type: "DEPOSIT" as const,
    driver: { employee: { companyId } },
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(fromDate || toDate
      ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [deposits, driverRows, agg] = await Promise.all([
    prisma.driverWalletTransaction.findMany({
      where,
      include: {
        driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
        bankAccount: { select: { nameAr: true, nameEn: true, bankName: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.driver.findMany({
      where: { employee: { companyId, isDeleted: false } },
      include: { employee: { select: { nameAr: true, nameEn: true } } },
      orderBy: { employee: { nameAr: "asc" } },
    }),
    prisma.driverWalletTransaction.aggregate({ where, _sum: { amount: true }, _count: true }),
  ]);

  const driverOptions = driverRows.map((d) => ({
    id: d.id,
    name: en ? d.employee.nameEn ?? d.employee.nameAr : d.employee.nameAr,
  }));

  const totalAmount = Number(agg._sum.amount ?? 0);
  const selectedDriver = sp.driverId ? driverRows.find((d) => d.id === sp.driverId) : null;
  const selectedDriverBalance = selectedDriver ? Number(selectedDriver.walletBalance) : null;

  const printQuery = new URLSearchParams({
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(sp.from ? { from: sp.from } : {}),
    ...(sp.to ? { to: sp.to } : {}),
  }).toString();

  const methodLabel = (m: string | null) =>
    m === "BANK" ? (en ? "Bank" : "بنك") : en ? "Cash" : "نقدي";

  return (
    <div>
      <Header
        title={en ? "Driver Deposits" : "إيداعات السائقين"}
        subtitle={en ? "Amounts drivers deposited into the company" : "المبالغ التي أودعها السائقون للشركة"}
        companyId={companyId}
        actions={
          <a
            href={`/dashboard/companies/${companyId}/delivery/deposits/print${printQuery ? `?${printQuery}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Printer size={16} />
            {en ? "Print report" : "طباعة التقرير"}
          </a>
        }
      />
      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div>
              <p className="number text-2xl font-bold">{agg._count}</p>
              <p className="text-xs text-muted-foreground">{en ? "Deposits count" : "عدد الإيداعات"}</p>
            </div>
          </div>
          <div className="stat-card">
            <div>
              <p className="number text-2xl font-bold text-emerald-600">{formatKWD(totalAmount, numberLocale)}</p>
              <p className="text-xs text-muted-foreground">{en ? "Total deposited" : "إجمالي المُودع"}</p>
            </div>
          </div>
        </div>

        {/* فلتر: السائق + نطاق التاريخ */}
        <form method="GET" className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Driver" : "السائق"}</label>
            <select name="driverId" defaultValue={sp.driverId ?? ""} className="input-field w-full sm:w-64">
              <option value="">{en ? "All drivers" : "كل السائقين"}</option>
              {driverOptions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "From" : "من"}</label>
            <input type="date" name="from" defaultValue={sp.from ?? ""} className="input-field" dir="ltr" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "To" : "إلى"}</label>
            <input type="date" name="to" defaultValue={sp.to ?? ""} className="input-field" dir="ltr" />
          </div>
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {en ? "Filter" : "تصفية"}
          </button>
          {(sp.driverId || sp.from || sp.to) && (
            <a href={`/dashboard/companies/${companyId}/delivery/deposits`} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              {en ? "Clear" : "مسح"}
            </a>
          )}
        </form>

        {selectedDriver && (
          <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-blue-50/60 p-4">
            <div>
              <p className="text-xs text-muted-foreground">{en ? "Driver's current wallet balance" : "الرصيد الحالي في محفظة السائق"}</p>
              <p className={`number text-2xl font-bold ${(selectedDriverBalance ?? 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {formatKWD(selectedDriverBalance ?? 0, numberLocale)}
              </p>
              <p className="text-[11px] text-muted-foreground">{en ? "Outstanding amount still owed" : "المبلغ المتبقّي على السائق"}</p>
            </div>
            <div className="border-r pr-6 rtl:border-l rtl:border-r-0 rtl:pl-6 rtl:pr-0">
              <p className="text-xs text-muted-foreground">{en ? "Total deposited (filtered)" : "إجمالي المُودع (حسب التصفية)"}</p>
              <p className="number text-2xl font-bold text-emerald-600">{formatKWD(totalAmount, numberLocale)}</p>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{en ? "Date" : "التاريخ"}</th>
                  <th>{en ? "Driver" : "السائق"}</th>
                  <th>{en ? "Amount" : "المبلغ"}</th>
                  <th>{en ? "Method" : "طريقة الدفع"}</th>
                  <th>{en ? "Bank account" : "الحساب البنكي"}</th>
                  <th>{en ? "Notes" : "ملاحظات"}</th>
                </tr>
              </thead>
              <tbody>
                {deposits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {en ? "No deposits found" : "لا توجد إيداعات"}
                    </td>
                  </tr>
                ) : (
                  deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-muted/30">
                      <td className="text-sm">{formatDate(d.date, numberLocale)}</td>
                      <td className="font-medium">{en ? d.driver.employee.nameEn ?? d.driver.employee.nameAr : d.driver.employee.nameAr}</td>
                      <td className="number font-bold text-emerald-600">{formatKWD(Number(d.amount), numberLocale)}</td>
                      <td className="text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${d.paymentMethod === "BANK" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                          {methodLabel(d.paymentMethod)}
                        </span>
                      </td>
                      <td className="text-sm">
                        {d.bankAccount
                          ? `${en ? d.bankAccount.nameEn ?? d.bankAccount.nameAr : d.bankAccount.nameAr} — ${d.bankAccount.bankName}`
                          : "-"}
                      </td>
                      <td className="text-sm text-muted-foreground">{d.descriptionAr ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
