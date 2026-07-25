import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { DriverTrackingDetail } from "@/components/driver-tracking/driver-tracking-detail";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function DriverTrackingSessionPage(props: { params: Promise<{ companyId: string; sessionId: string }> }) {
  const session = await getSession(); if (!session) redirect("/login");
  const { companyId, sessionId } = await props.params; const locale = await getLocale(); const en = locale === "en";
  if (!hasPermission(session, "DRIVER_TRACKING", "VIEW_HISTORY", { companyId })) notFound();
  const trackingSession = await prisma.driverTrackingSession.findFirst({ where: { id: sessionId, companyId }, include: { user: { select: { nameAr: true, nameEn: true } }, locationPoints: { orderBy: { recordedAt: "asc" } } } });
  if (!trackingSession) notFound();
  const driverName = en ? trackingSession.user.nameEn ?? trackingSession.user.nameAr : trackingSession.user.nameAr;
  const date = (value: Date | null) => value ? value.toLocaleString(en ? "en-US" : "ar-KW") : "—";
  const duration = trackingSession.endedAt ? Math.round((trackingSession.endedAt.getTime() - trackingSession.startedAt.getTime()) / 60_000) : null;
  const points = trackingSession.locationPoints.map((point) => ({ id: point.id, latitude: Number(point.latitude), longitude: Number(point.longitude), accuracy: point.accuracy == null ? null : Number(point.accuracy), speed: point.speed == null ? null : Number(point.speed), recordedAt: point.recordedAt.toISOString(), receivedAt: point.receivedAt.toISOString() }));
  return <div><Header title={driverName} subtitle={en ? "Tracking session route" : "مسار جلسة التتبّع"} companyId={companyId} /><main className="page-container space-y-4 py-6"><Link href={`/dashboard/companies/${companyId}/driver-tracking/drivers/${trackingSession.userId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight className="h-4 w-4" />{en ? "Back to driver" : "العودة إلى السائق"}</Link><Card><CardContent className="grid gap-4 p-5 text-sm sm:grid-cols-4"><div><p className="text-muted-foreground">{en ? "Status" : "الحالة"}</p><p className="font-medium">{trackingSession.status}</p></div><div><p className="text-muted-foreground">{en ? "Started" : "البداية"}</p><p className="font-medium">{date(trackingSession.startedAt)}</p></div><div><p className="text-muted-foreground">{en ? "Ended" : "النهاية"}</p><p className="font-medium">{date(trackingSession.endedAt)}</p></div><div><p className="text-muted-foreground">{en ? "Duration" : "المدة"}</p><p className="font-medium">{duration == null ? "—" : `${duration} ${en ? "min" : "د"}`}</p></div></CardContent></Card><DriverTrackingDetail driverName={driverName} points={points} /></main></div>;
}
