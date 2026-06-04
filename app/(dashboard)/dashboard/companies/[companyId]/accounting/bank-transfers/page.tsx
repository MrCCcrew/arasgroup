import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ArrowRightLeft } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function BankTransfersPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const pageSize = 25;

  const [total, transfers] = await Promise.all([
    prisma.accountTransfer.count({ where: { companyId } }),
    prisma.accountTransfer.findMany({
      where: { companyId },
      include: {
        sourceBankAccount: { select: { nameAr: true, bankName: true } },
        destinationBankAccount: { select: { nameAr: true, bankName: true } },
      },
      orderBy: { transferDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const totalAmount = transfers.reduce((sum, t) => sum + Number(t.amount), 0);

  const t = {
    title: en ? "Bank Transfers" : "التحويلات البنكية",
    subtitle: en ? "Transfer between bank accounts" : "التحويل بين الحسابات البنكية",
    new: en ? "New Transfer" : "تحويل جديد",
    count: en ? "Transfers" : "عدد التحويلات",
    totalAmount: en ? "Total transferred" : "إجمالي المحول",
    date: en ? "Date" : "التاريخ",
    from: en ? "From" : "من",
    to: en ? "To" : "إلى",
    amount: en ? "Amount" : "المبلغ",
    purpose: en ? "Purpose" : "الغرض",
    reference: en ? "Reference" : "المرجع",
    empty: en ? "No transfers — click \"New Transfer\" to start" : "لا توجد تحويلات — اضغط \"تحويل جديد\" للبدء",
    prev: en ? "Previous" : "السابق",
    next: en ? "Next" : "التالي",
    pageOf: (p: number, tp: number, tt: number) =>
      en ? `Page ${p} of ${tp} — ${tt} transfer(s)` : `صفحة ${p} من ${tp} — ${tt} تحويل`,
  };

  return (
    <div>
      <Header title={t.title} subtitle={t.subtitle} companyId={companyId} />

      <div className="page-container space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/dashboard/companies/${companyId}/accounting/bank-transfers/new`}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} />
            {t.new}
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.count}</p>
            <p className="number text-2xl font-bold">{total}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.totalAmount}</p>
            <p className="number text-2xl font-bold">{formatKWD(totalAmount, numberLocale)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.from}</th>
                  <th className="text-center">
                    <ArrowRightLeft size={16} className="inline" />
                  </th>
                  <th>{t.to}</th>
                  <th>{t.amount}</th>
                  <th>{t.purpose}</th>
                  <th>{t.reference}</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      {t.empty}
                    </td>
                  </tr>
                ) : (
                  transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-muted/30">
                      <td className="text-sm">{formatDate(transfer.transferDate, numberLocale)}</td>
                      <td>
                        <div className="text-sm font-medium">{transfer.sourceBankAccount.nameAr}</div>
                        <div className="text-xs text-muted-foreground">
                          {transfer.sourceBankAccount.bankName}
                        </div>
                      </td>
                      <td className="text-center text-primary">
                        <ArrowRightLeft size={18} />
                      </td>
                      <td>
                        <div className="text-sm font-medium">
                          {transfer.destinationBankAccount.nameAr}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {transfer.destinationBankAccount.bankName}
                        </div>
                      </td>
                      <td className="number font-bold text-primary">
                        {formatKWD(Number(transfer.amount), numberLocale)}
                      </td>
                      <td className="text-sm">{transfer.purposeAr}</td>
                      <td className="text-xs text-muted-foreground">{transfer.reference || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">{t.pageOf(page, totalPages, total)}</p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}`}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {t.prev}
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?page=${page + 1}`}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {t.next}
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
