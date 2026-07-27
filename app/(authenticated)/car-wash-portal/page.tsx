import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { redirect } from "next/navigation";

export default async function CarWashPortalPage() {
  const session = await getSession();
  if (!session) redirect("/login?portal=driver");
  const context = await getCarWashPortalContext(session);
  if (!context) redirect("/dashboard");
  return <div className="space-y-4"><section className="rounded-xl bg-cyan-700 p-5 text-white"><p className="text-sm opacity-80">{context.company.nameEn ?? context.company.nameAr}</p><h1 className="text-2xl font-bold">Daily operations</h1></section><div className="grid gap-3"><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/expenses">Record expense</Link><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/revenues">Record revenue</Link><Link className="rounded-xl border bg-white p-5 font-semibold" href="/car-wash-portal/history">View history</Link></div></div>;
}
