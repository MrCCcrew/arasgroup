import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getPartnerFromSession } from "@/lib/owner-management/access";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function PartnerPortal() {
  const session = await getSession(); if (!session) redirect("/login");
  const partner = await getPartnerFromSession(session); if (!partner) redirect("/dashboard");
  const [r, e] = await Promise.all([prisma.ownerManagedRevenue.aggregate({ where: { partnerId: partner.id, status: "MATCHED" }, _sum: { amount: true } }), prisma.ownerManagedExpense.aggregate({ where: { partnerId: partner.id, deletedAt: null }, _sum: { amount: true } })]);
  const revenue = Number(r._sum.amount ?? 0), expense = Number(e._sum.amount ?? 0);
  return <main dir="rtl" className="min-h-screen bg-muted/30 p-4 md:p-8"><section className="mx-auto max-w-4xl space-y-6"><header><h1 className="text-2xl font-bold">بوابة الشريك</h1><p className="text-sm text-muted-foreground">{partner.name} · MID: <span dir="ltr">{partner.mid}</span></p></header><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Card title="الإيرادات" value={revenue}/><Card title="المصروفات" value={expense}/><Card title="صافي الحساب" value={revenue-expense}/></div><div className="section-card grid grid-cols-2 gap-3 md:grid-cols-4"><Link className="rounded-lg border p-3 text-center" href="/partner/expenses">رفع فاتورة وفواتيري</Link><Link className="rounded-lg border p-3 text-center" href="/partner/revenues">إيراداتي</Link><Link className="rounded-lg border p-3 text-center" href="/partner/statement">كشف حسابي</Link><Link className="rounded-lg border p-3 text-center" href="/api/owner-management/partner/summary">تحديث الملخص</Link></div></section></main>;
}
function Card({ title, value }: { title: string; value: number }) { return <div className="section-card"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-bold" dir="ltr">{value.toFixed(3)} KWD</p></div>; }
