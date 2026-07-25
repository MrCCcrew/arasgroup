import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { DriverTrackingDriverDetail } from "@/components/driver-tracking/driver-tracking-driver-detail";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getLocale } from "@/lib/i18n";
import { redirect } from "next/navigation";

export default async function DriverTrackingDriverPage(props: { params: Promise<{ companyId: string; driverId: string }> }) {
  const session = await getSession(); if (!session) redirect("/login");
  const { companyId, driverId } = await props.params; const locale = await getLocale(); const en = locale === "en";
  if (!hasPermission(session, "DRIVER_TRACKING", "VIEW_HISTORY", { companyId })) return <div className="page-container py-6 text-sm text-muted-foreground">{en ? "You are not authorized to view tracking history." : "غير مصرح لك بعرض سجل التتبّع."}</div>;
  return <div><Header title={en ? "Driver tracking" : "تتبّع السائقين"} subtitle={en ? "Driver history and tracking records" : "سجل السائق وسجلات التتبّع"} companyId={companyId} /><main className="page-container space-y-4 py-6"><Link href={`/dashboard/companies/${companyId}/driver-tracking`} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight className="h-4 w-4" />{en ? "Back to drivers" : "العودة إلى السائقين"}</Link><DriverTrackingDriverDetail companyId={companyId} driverId={driverId} canDelete={hasPermission(session, "DRIVER_TRACKING", "DELETE", { companyId })} /></main></div>;
}
