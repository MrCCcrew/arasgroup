import { FinancePrintToolbar } from "@/components/finance/print-toolbar";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireOwnerManagedCompany } from "@/lib/owner-management/access";
import { prisma } from "@/lib/db";

export default async function VoucherPage({ params, searchParams }: { params: Promise<{ companyId: string; entryId: string }>; searchParams: Promise<{ type?: string }> }) {
  const { companyId, entryId } = await params;
  const { type } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
  const company = await requireOwnerManagedCompany(session, companyId);
  if (!company || (type !== "revenues" && type !== "expenses")) notFound();
  const revenue = type === "revenues";
  const row = revenue
    ? await prisma.ownerManagedRevenue.findFirst({ where: { id: entryId, companyId, status: "MATCHED" }, include: { partner: true } })
    : await prisma.ownerManagedExpense.findFirst({ where: { id: entryId, companyId, deletedAt: null }, include: { partner: true } });
  if (!row) notFound();
  const date = "transactionDate" in row ? row.transactionDate : row.invoiceDate;
  const notes = "description" in row ? row.description : row.notes;
  return <div dir="rtl" className="page-container">
    <FinancePrintToolbar backHref={`/dashboard/companies/${companyId}/owner-management/${type}`} />
    <article className="finance-document mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b-2 pb-6">
        <div><h2 className="text-xl font-bold leading-9">{company.nameAr}</h2><p className="mt-2 text-sm">{company.nameEn}</p></div>
        {company.logoUrl && <img src={company.logoUrl} alt={company.nameAr} className="h-24 w-36 object-contain" />}
        <div className="rounded-lg border-2 border-blue-900 px-6 py-3 text-center"><h1 className="text-xl font-bold">{revenue ? "سند قبض" : "سند صرف"}</h1><p className="mt-1 text-xs">{revenue ? "Receipt Voucher" : "Payment Voucher"}</p></div>
      </header>
      <div className="grid gap-4 border-b pb-5 sm:grid-cols-2"><p className="break-all">رقم السند: <span dir="ltr">{row.id}</span></p><p>التاريخ: {date?.toISOString().slice(0, 10)}</p></div>
      <p className="border-b pb-4">{revenue ? "استلمنا من" : "صرفنا إلى"}: <strong>{row.partner?.name ?? "—"}</strong></p>
      <p className="rounded-lg border-2 border-blue-900 bg-blue-50/50 p-4 text-xl font-bold">المبلغ: <span dir="ltr">{Number(row.amount).toFixed(3)}</span> د.ك</p>
      <p className="min-h-20 whitespace-pre-wrap break-words">البيان: {notes || "—"}</p>
      <div className="grid grid-cols-3 gap-6 pt-12 text-center text-sm">{["المحرر", "المستلم", "اعتماد الإدارة"].map(label => <div key={label} className="border-t border-slate-400 pt-4">{label}</div>)}</div>
    </article>
  </div>;
}
