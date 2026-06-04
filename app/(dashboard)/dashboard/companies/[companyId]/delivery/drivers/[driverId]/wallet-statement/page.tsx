import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; driverId: string }>;
  searchParams: Promise<{ page?: string }>;
}

const TYPE_LABELS = {
  ar: {
    CHARGE: "تحصيل (خصم)",
    DEPOSIT: "إيداع (دفع)",
    SETTLEMENT: "تسوية",
  },
  en: {
    CHARGE: "Charge",
    DEPOSIT: "Deposit",
    SETTLEMENT: "Settlement",
  },
} as const;

export default async function WalletStatementPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, driverId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      walletBalance: true,
      employee: {
        select: {
          companyId: true,
          nameAr: true,
          nameEn: true,
          employeeNumber: true
        }
      },
    },
  });

  if (!driver || driver.employee.companyId !== companyId) {
    redirect(`/dashboard/companies/${companyId}/delivery/drivers`);
  }

  const page = parseInt(sp.page ?? "1", 10);
  const pageSize = 50;

  const [total, transactions] = await Promise.all([
    prisma.driverWalletTransaction.count({ where: { driverId } }),
    prisma.driverWalletTransaction.findMany({
      where: { driverId },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  const driverName = locale === "en"
    ? driver.employee.nameEn ?? driver.employee.nameAr
    : driver.employee.nameAr;

  return (
    <div>
      <Header
        title={locale === "en" ? "Wallet Statement" : "كشف حساب المحفظة"}
        subtitle={driverName}
        companyId={companyId}
      />

      <div className="page-container space-y-4">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={16} />
          {locale === "en" ? "Back to driver details" : "العودة لتفاصيل السائق"}
        </Link>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Current Balance" : "الرصيد الحالي"}
            </p>
            <p className={`number text-2xl font-bold ${Number(driver.walletBalance) > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatKWD(Number(driver.walletBalance), numberLocale)}
            </p>
          </div>

          <div className="stat-card">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Total Transactions" : "إجمالي الحركات"}
            </p>
            <p className="text-2xl font-bold">{total}</p>
          </div>

          <div className="stat-card">
            <p className="text-xs text-muted-foreground">
              {locale === "en" ? "Employee Number" : "رقم الموظف"}
            </p>
            <p className="text-lg font-medium">{driver.employee.employeeNumber || "—"}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Amount" : "المبلغ"}</th>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Settled" : "مسوى"}</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No transactions found" : "لا توجد حركات"}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="text-sm">{formatDate(tx.date, numberLocale)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            tx.type === "CHARGE"
                              ? "bg-red-50 text-red-700"
                              : tx.type === "DEPOSIT"
                                ? "bg-green-50 text-green-700"
                                : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {TYPE_LABELS[locale][tx.type]}
                        </span>
                      </td>
                      <td
                        className={`number font-bold ${
                          tx.type === "CHARGE" ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {tx.type === "CHARGE" ? "+" : "-"}
                        {formatKWD(Number(tx.amount), numberLocale)}
                      </td>
                      <td className="text-sm">{tx.descriptionAr || "—"}</td>
                      <td className="text-center">
                        {tx.isSettled ? (
                          <span className="text-xs text-green-600">✓</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}/wallet-statement?page=${p}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
