import { getSession } from "@/lib/auth/session";
import { getCarWashPortalContext } from "@/lib/auth/car-wash-portal";
import { redirect } from "next/navigation";
import { CarWashPortalNavigation } from "@/components/car-wash/portal-navigation";

export default async function CarWashPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?portal=car-wash&expired=1");
  const context = await getCarWashPortalContext(session);
  if (!context) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-slate-50 pb-24 pt-28">
      <CarWashPortalNavigation userNameAr={session.nameAr} userNameEn={session.nameEn} userEmail={session.email} companyNameAr={context.company.nameAr} companyNameEn={context.company.nameEn} />
      <main className="mx-auto max-w-lg p-4">{children}</main>
    </div>
  );
}
