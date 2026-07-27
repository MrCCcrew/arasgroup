import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { requireOwnerManagedCompany } from "@/lib/owner-management/access";
import { prisma } from "@/lib/db";

export default async function OwnerManagedPartnerPage({ params }: { params: Promise<{ companyId: string; partnerId: string }> }) {
  const { companyId, partnerId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  if (!await requireOwnerManagedCompany(session, companyId)) notFound();
  const partner = await prisma.ownerManagedPartner.findFirst({ where: { id: partnerId, companyId }, include: { user: { select: { email: true } }, _count: { select: { expenses: true, revenues: true } } } });
  if (!partner) notFound();
  return <div className="page-container space-y-6" dir="rtl">
    <div><h1 className="text-2xl font-bold">{partner.name}</h1><p className="text-muted-foreground">بيانات الشريك</p></div>
    <dl className="section-card grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">الهاتف</dt><dd dir="ltr">{partner.phone || "—"}</dd></div><div><dt className="text-sm text-muted-foreground">البريد</dt><dd dir="ltr">{partner.email || partner.user.email}</dd></div><div><dt className="text-sm text-muted-foreground">MID</dt><dd dir="ltr">{partner.mid}</dd></div><div><dt className="text-sm text-muted-foreground">الحالة</dt><dd>{partner.isActive ? "نشط" : "غير نشط"}</dd></div><div><dt className="text-sm text-muted-foreground">الإيرادات</dt><dd>{partner._count.revenues}</dd></div><div><dt className="text-sm text-muted-foreground">المصروفات</dt><dd>{partner._count.expenses}</dd></div></dl>
    <Link className="text-primary underline" href={`/dashboard/companies/${companyId}/owner-management/partners`}>العودة للشركاء</Link>
  </div>;
}
