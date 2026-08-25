import { redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { DepositSubmissionActions } from "@/components/delivery/deposit-submission-actions";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ driverId?: string; from?: string; to?: string; month?: string; year?: string }>;
}

export default async function DriverDepositsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";

  // Default to current month/year if not specified
  const now = new Date();
  const currentMonth = String(now.getMonth() + 1);
  const currentYear = String(now.getFullYear());
  const effectiveMonth = sp.month ?? currentMonth;
  const effectiveYear = sp.year ?? currentYear;

  // نطاق التواريخ (اختياري) — to شامل لليوم بالكامل
  let fromDate = sp.from ? new Date(sp.from) : undefined;
  let toDate = sp.to ? new Date(`${sp.to}T23:59:59.999`) : undefined;

  // Override with month/year if provided
  if (effectiveMonth && effectiveYear) {
    const monthNum = Number.parseInt(effectiveMonth, 10);
    const yearNum = Number.parseInt(effectiveYear, 10);
    fromDate = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
    toDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
  } else if (effectiveYear && !sp.from && !sp.to) {
    const yearNum = Number.parseInt(effectiveYear, 10);
    fromDate = new Date(yearNum, 0, 1, 0, 0, 0, 0);
    toDate = new Date(yearNum, 11, 31, 23, 59, 59, 999);
  }

  const where = {
    type: "DEPOSIT" as const,
    driver: { employee: { companyId } },
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    ...(fromDate || toDate
      ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {}),
  };

  const [deposits, driverRows, agg, uploadedDeposits] = await Promise.all([
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
    prisma.driverDepositSubmission.findMany({ where: { companyId, deletedAt: null, ...(sp.driverId ? { driverId: sp.driverId } : {}), ...(fromDate || toDate ? { depositDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}) }, include: { driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } } }, orderBy: [{ reviewStatus: "asc" }, { createdAt: "desc" }] }),
  ]);

  type DepositRow = typeof deposits[number];
  type DepositDriverRow = typeof driverRows[number];
  const driverOptions = driverRows.map((d: DepositDriverRow) => ({
    id: d.id,
    name: en ? d.employee.nameEn ?? d.employee.nameAr : d.employee.nameAr,
  }));

  const totalAmount = Number(agg._sum.amount ?? 0);
  const selectedDriver = sp.driverId ? driverRows.find((d: DepositDriverRow) => d.id === sp.driverId) : null;
  const selectedDriverBalance = selectedDriver ? Number(selectedDriver.walletBalance) : null;

  const printQuery = new URLSearchParams({
    ...(sp.driverId ? { driverId: sp.driverId } : {}),
    month: effectiveMonth,
    year: effectiveYear,
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
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Year" : "السنة"}</label>
            <select name="year" defaultValue={effectiveYear} className="input-field w-28">
              <option value="">{en ? "All" : "الكل"}</option>
              {Array.from({ length: 5 }, (_: unknown, i: number) => new Date().getFullYear() - i).map((y: number) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Month" : "الشهر"}</label>
            <select name="month" defaultValue={effectiveMonth} className="input-field w-28">
              <option value="">{en ? "All" : "الكل"}</option>
              <option value="1">{en ? "Jan" : "يناير"}</option>
              <option value="2">{en ? "Feb" : "فبراير"}</option>
              <option value="3">{en ? "Mar" : "مارس"}</option>
              <option value="4">{en ? "Apr" : "أبريل"}</option>
              <option value="5">{en ? "May" : "مايو"}</option>
              <option value="6">{en ? "Jun" : "يونيو"}</option>
              <option value="7">{en ? "Jul" : "يوليو"}</option>
              <option value="8">{en ? "Aug" : "أغسطس"}</option>
              <option value="9">{en ? "Sep" : "سبتمبر"}</option>
              <option value="10">{en ? "Oct" : "أكتوبر"}</option>
              <option value="11">{en ? "Nov" : "نوفمبر"}</option>
              <option value="12">{en ? "Dec" : "ديسمبر"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{en ? "Driver" : "السائق"}</label>
            <select name="driverId" defaultValue={sp.driverId ?? ""} className="input-field w-full sm:w-64">
              <option value="">{en ? "All drivers" : "كل السائقين"}</option>
              {driverOptions.map((d: { id: string; name: string }) => (
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
                  deposits.map((d: DepositRow) => (
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
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3"><h2 className="font-semibold">{en ? "Uploaded deposit receipts" : "إيصالات الإيداعات المرفوعة"}</h2><p className="text-xs text-muted-foreground">{en ? "Approve to add the amount to the driver's wallet." : "لا يُحتسب الإيداع في المحفظة إلا بعد الموافقة."}</p></div>
          <div className="overflow-x-auto"><table className="ar-table"><thead><tr><th>{en ? "Date" : "التاريخ"}</th><th>{en ? "Driver" : "السائق"}</th><th>{en ? "Amount" : "المبلغ"}</th><th>{en ? "Reference" : "رقم العملية"}</th><th>{en ? "Status" : "الحالة"}</th><th>{en ? "Actions" : "الإجراءات"}</th></tr></thead><tbody>{uploadedDeposits.length===0?<tr><td colSpan={6} className="py-6 text-center text-muted-foreground">{en?"No uploaded receipts":"لا توجد إيصالات مرفوعة"}</td></tr>:uploadedDeposits.map((row)=><tr key={row.id}><td>{formatDate(row.depositDate,numberLocale)}</td><td>{en?row.driver.employee.nameEn??row.driver.employee.nameAr:row.driver.employee.nameAr}</td><td className="number font-bold text-emerald-600">{formatKWD(Number(row.amount),numberLocale)}</td><td dir="ltr">{row.transactionReference??"—"}</td><td>{row.reviewStatus==="APPROVED"?(en?"Approved":"معتمد"):row.reviewStatus==="REJECTED"?(en?"Rejected":"مرفوض"):(en?"Pending":"قيد المراجعة")}</td><td><DepositSubmissionActions id={row.id} imagePath={row.imagePath} amount={Number(row.amount)} date={row.depositDate.toLocaleDateString("en-CA")} notes={row.notes} status={row.reviewStatus}/></td></tr>)}</tbody></table></div>
        </div>
      </div>
    </div>
  );
}
