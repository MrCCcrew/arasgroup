import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
}

export default async function ReceiptsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const page = Math.max(1, parseInt(sp.page ?? "1"));
  const pageSize = 25;

  const where = {
    companyId,
    type: "RECEIPT" as const,
    isDeleted: false,
    ...(sp.from || sp.to ? {
      date: {
        ...(sp.from ? { gte: new Date(sp.from) } : {}),
        ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}),
      },
    } : {}),
  };

  const [total, entries, receiptsTotal] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: { account: { select: { code: true, nameAr: true, nameEn: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.journalEntryLine.aggregate({
      where: {
        journalEntry: where,
        credit: { gt: 0 },
      },
      _sum: { credit: true },
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const totalAmount = Number(receiptsTotal._sum.credit ?? 0);

  function getReceiptInfo(entry: typeof entries[0]) {
    const creditLine = entry.lines.find((l: typeof entry.lines[number]) => Number(l.credit) > 0);
    const debitLine = entry.lines.find((l: typeof entry.lines[number]) => Number(l.debit) > 0);
    const amount = Number(creditLine?.credit ?? 0);
    const method = debitLine?.descriptionAr === "نقدي" ? "cash" : debitLine?.descriptionAr === "بنك" ? "bank" : "none";
    return { creditAccount: creditLine?.account, debitAccount: debitLine?.account, amount, method };
  }

  const t = {
    title: en ? "Receipt Vouchers" : "سندات القبض",
    subtitle: en ? "All company receipts" : "جميع مقبوضات الشركة",
    new: en ? "New receipt" : "سند قبض جديد",
    from: en ? "From date" : "من تاريخ",
    to: en ? "To date" : "إلى تاريخ",
    search: en ? "Search" : "بحث",
    clear: en ? "Clear filter" : "مسح الفلتر",
    count: en ? "Vouchers" : "عدد السندات",
    totalReceived: en ? "Total received" : "إجمالي المقبوض",
    date: en ? "Date" : "التاريخ",
    reference: en ? "Reference" : "المرجع",
    statement: en ? "Statement" : "البيان",
    receivedFrom: en ? "Received from" : "المستلم من",
    creditAccount: en ? "Credit account" : "الحساب الدائن",
    method: en ? "Method" : "طريقة القبض",
    amount: en ? "Amount" : "المبلغ",
    status: en ? "Status" : "الحالة",
    empty: en ? "No receipt vouchers — click \"New receipt\" to start" : "لا توجد سندات قبض — اضغط \"سند قبض جديد\" للبدء",
    cash: en ? "Cash" : "نقدي",
    bank: en ? "Bank" : "بنك",
    posted: en ? "Posted" : "مرحل",
    draft: en ? "Draft" : "مسودة",
    print: en ? "Print" : "طباعة",
    prev: en ? "Previous" : "السابق",
    next: en ? "Next" : "التالي",
    pageOf: (p: number, tp: number, tt: number) =>
      en ? `Page ${p} of ${tp} — ${tt} voucher(s)` : `صفحة ${p} من ${tp} — ${tt} سند`,
  };

  const methodLabel = (m: string) => (m === "cash" ? t.cash : m === "bank" ? t.bank : "—");

  return (
    <div>
      <Header
        title={t.title}
        subtitle={t.subtitle}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/accounting/receipts/new`}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} /> {t.new}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        {/* Filters */}
        <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <div>
            <label className="form-label">{t.from}</label>
            <input type="date" name="from" defaultValue={sp.from} className="input-field" />
          </div>
          <div>
            <label className="form-label">{t.to}</label>
            <input type="date" name="to" defaultValue={sp.to} className="input-field" />
          </div>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.search}</button>
          {(sp.from || sp.to) && (
            <Link href={`/dashboard/companies/${companyId}/accounting/receipts`} className="text-sm text-muted-foreground hover:underline">
              {t.clear}
            </Link>
          )}
        </form>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.count}</p>
            <p className="mt-1 text-2xl font-bold">{total}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.totalReceived}</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatKWD(totalAmount, numberLocale)}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.reference}</th>
                  <th>{t.statement}</th>
                  <th>{t.receivedFrom}</th>
                  <th>{t.creditAccount}</th>
                  <th>{t.method}</th>
                  <th>{t.amount}</th>
                  <th>{t.status}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      {t.empty}
                    </td>
                  </tr>
                ) : entries.map((entry: typeof entries[number]) => {
                  const { creditAccount, amount, method } = getReceiptInfo(entry);
                  const parts = entry.descriptionAr.split(" — ");
                  const desc = parts[0];
                  const party = parts.length > 1 ? parts.slice(1).join(" — ") : null;
                  const accountName = creditAccount ? (en ? creditAccount.nameEn ?? creditAccount.nameAr : creditAccount.nameAr) : null;
                  return (
                    <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="text-sm">{new Date(entry.date).toLocaleDateString(numberLocale)}</td>
                      <td className="font-mono text-xs">{entry.reference ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="max-w-xs truncate text-sm">{desc}</td>
                      <td className="text-sm">{party ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-sm">
                        {creditAccount
                          ? <span>{creditAccount.code} - {accountName}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${method === "cash" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {methodLabel(method)}
                        </span>
                      </td>
                      <td className="number font-bold text-emerald-600">{formatKWD(amount, numberLocale)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          entry.status === "POSTED" ? "bg-green-100 text-green-700" :
                          entry.status === "DRAFT" ? "bg-gray-100 text-gray-600" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {entry.status === "POSTED" ? t.posted : entry.status === "DRAFT" ? t.draft : entry.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}/print`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Printer size={12} /> {t.print}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">{t.pageOf(page, totalPages, total)}</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/dashboard/companies/${companyId}/accounting/receipts?page=${page - 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
                  >{t.prev}</Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/dashboard/companies/${companyId}/accounting/receipts?page=${page + 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
                  >{t.next}</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
