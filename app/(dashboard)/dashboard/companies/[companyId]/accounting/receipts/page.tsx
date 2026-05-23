import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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

  const [total, entries] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: { account: { select: { code: true, nameAr: true } } },
        },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize);
  const totalAmount = entries.reduce((s, e) =>
    s + e.lines.filter((l) => Number(l.credit) > 0).reduce((a, l) => a + Number(l.credit), 0), 0
  );

  function getReceiptInfo(entry: typeof entries[0]) {
    const creditLine = entry.lines.find((l) => Number(l.credit) > 0);
    const debitLine = entry.lines.find((l) => Number(l.debit) > 0);
    const amount = Number(creditLine?.credit ?? 0);
    const method = debitLine?.descriptionAr === "نقدي" ? "نقدي" : debitLine?.descriptionAr === "بنك" ? "بنك" : "—";
    return { creditAccount: creditLine?.account, debitAccount: debitLine?.account, amount, method };
  }

  return (
    <div>
      <Header
        title="سندات القبض"
        subtitle="جميع مقبوضات الشركة"
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/accounting/receipts/new`}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} /> سند قبض جديد
          </Link>
        }
      />

      <div className="page-container space-y-4">
        {/* Filters */}
        <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
          <div>
            <label className="form-label">من تاريخ</label>
            <input type="date" name="from" defaultValue={sp.from} className="input-field" />
          </div>
          <div>
            <label className="form-label">إلى تاريخ</label>
            <input type="date" name="to" defaultValue={sp.to} className="input-field" />
          </div>
          <input type="hidden" name="page" value="1" />
          <button type="submit" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">بحث</button>
          {(sp.from || sp.to) && (
            <Link href={`/dashboard/companies/${companyId}/accounting/receipts`} className="text-sm text-muted-foreground hover:underline">
              مسح الفلتر
            </Link>
          )}
        </form>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">عدد السندات</p>
            <p className="mt-1 text-2xl font-bold">{total}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي المقبوض</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatKWD(totalAmount)}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المرجع</th>
                  <th>البيان</th>
                  <th>المستلم من</th>
                  <th>الحساب الدائن</th>
                  <th>طريقة القبض</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      لا توجد سندات قبض — اضغط "سند قبض جديد" للبدء
                    </td>
                  </tr>
                ) : entries.map((entry) => {
                  const { creditAccount, amount, method } = getReceiptInfo(entry);
                  const parts = entry.descriptionAr.split(" — ");
                  const desc = parts[0];
                  const party = parts.length > 1 ? parts.slice(1).join(" — ") : null;
                  return (
                    <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="text-sm">{new Date(entry.date).toLocaleDateString("ar-KW")}</td>
                      <td className="font-mono text-xs">{entry.reference ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="max-w-xs truncate text-sm">{desc}</td>
                      <td className="text-sm">{party ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-sm">
                        {creditAccount
                          ? <span>{creditAccount.code} - {creditAccount.nameAr}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${method === "نقدي" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                          {method}
                        </span>
                      </td>
                      <td className="number font-bold text-emerald-600">{formatKWD(amount)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          entry.status === "POSTED" ? "bg-green-100 text-green-700" :
                          entry.status === "DRAFT" ? "bg-gray-100 text-gray-600" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {entry.status === "POSTED" ? "مرحل" : entry.status === "DRAFT" ? "مسودة" : entry.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/companies/${companyId}/accounting/journal-entries/${entry.id}/print`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Printer size={12} /> طباعة
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
              <p className="text-sm text-muted-foreground">صفحة {page} من {totalPages} — {total} سند</p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/dashboard/companies/${companyId}/accounting/receipts?page=${page - 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
                  >السابق</Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/dashboard/companies/${companyId}/accounting/receipts?page=${page + 1}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`}
                    className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
                  >التالي</Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
