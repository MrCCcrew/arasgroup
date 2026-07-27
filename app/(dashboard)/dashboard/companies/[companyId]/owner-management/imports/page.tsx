import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireOwnerManagedCompany } from "@/lib/owner-management/access";
import { prisma } from "@/lib/db";

export default async function OwnerManagedImportsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!await requireOwnerManagedCompany(session, companyId)) notFound();
  const imports = await prisma.ownerManagedStatementImport.findMany({ where: { companyId }, include: { _count: { select: { revenues: true } } }, orderBy: { createdAt: "desc" } });
  return <div className="page-container space-y-6" dir="rtl"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">سجل الاستيراد</h1><p className="text-sm text-muted-foreground">كشوف الحساب المؤكدة فقط.</p></div><Link className="rounded bg-primary px-4 py-2 text-primary-foreground" href={`/dashboard/companies/${companyId}/owner-management/import`}>رفع كشف حساب</Link></div><div className="section-card overflow-x-auto"><table className="w-full text-right text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">الملف</th><th className="p-2">تاريخ الاستيراد</th><th className="p-2">تاريخ التأكيد</th><th className="p-2">العمليات</th></tr></thead><tbody>{imports.length === 0 ? <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">لا توجد عمليات استيراد مؤكدة.</td></tr> : imports.map(statement => <tr key={statement.id} className="border-b last:border-0"><td className="p-2">{statement.fileName}</td><td className="p-2">{statement.createdAt.toLocaleString("en-CA")}</td><td className="p-2">{statement.confirmedAt?.toLocaleString("en-CA") || "—"}</td><td className="p-2">{statement._count.revenues}</td></tr>)}</tbody></table></div><Link className="text-sm text-primary underline" href={`/dashboard/companies/${companyId}/owner-management`}>العودة للوحة إدارة المالك</Link></div>;
}
