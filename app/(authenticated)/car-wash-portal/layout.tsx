import { getSession } from "@/lib/auth/session";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function CarWashPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?portal=driver");
  const context = await getCarWashPortalContext(session);
  if (!context) redirect("/dashboard");
  return <div className="min-h-screen bg-slate-50 pb-20"><main className="mx-auto max-w-lg p-4"><header className="mb-5 flex items-center justify-between"><Link href="/car-wash-portal" className="font-bold text-slate-900">Car Wash Portal</Link><LanguageSwitcher /></header>{children}</main><nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t bg-white p-3 text-sm"><Link href="/car-wash-portal">Home</Link><Link href="/car-wash-portal/expenses">Expenses</Link><Link href="/car-wash-portal/revenues">Revenue</Link><Link href="/car-wash-portal/history">History</Link></nav></div>;
}
