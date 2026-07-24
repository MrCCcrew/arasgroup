import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { DriverTrackingOverview } from "@/components/driver-tracking/driver-tracking-overview";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function DriverTrackingPage(props: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await props.params;
  const [locale, company] = await Promise.all([getLocale(), prisma.company.findUnique({ where: { id: companyId }, select: { type: true } })]);
  const en = locale === "en";
  const module = company?.type === "CAR_WASH" ? "CAR_WASH_OPERATIONS" : "DELIVERY_OPERATIONS";
  if (!company || (company.type !== "DELIVERY" && company.type !== "CAR_WASH") || !hasPermission(session, module, "VIEW", { companyId })) {
    return <div className="page-container py-6 text-sm text-muted-foreground">{en ? "You are not authorized to view driver tracking." : "غير مصرح لك بعرض تتبع السائقين."}</div>;
  }
  return <div><Header title={en ? "Driver Tracking" : "تتبع السائقين"} subtitle={en ? "View the latest locations and routes reported by drivers" : "عرض آخر المواقع وخطوط السير التي أرسلها السائقون"} companyId={companyId} /><main className="page-container py-6"><DriverTrackingOverview companyId={companyId} /></main></div>;
}
