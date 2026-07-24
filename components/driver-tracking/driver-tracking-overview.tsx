"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clock3, MapPinned, Radio, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/providers/locale-provider";
import type { TrackingMapMarker } from "./tracking-map";

const TrackingMap = dynamic(() => import("./tracking-map").then((module) => module.TrackingMap), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-lg bg-muted" /> });

interface TrackingSession {
  id: string;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  startedAt: string;
  endedAt: string | null;
  driver: { nameAr: string; nameEn: string | null; accountType: "DRIVER" | "CAR_WASH_WORKER" };
  pointCount: number;
  lastLocation: { latitude: number; longitude: number; recordedAt: string; receivedAt: string } | null;
}

const statusClass: Record<TrackingSession["status"], string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  ENDED: "bg-slate-100 text-slate-700",
};

export function DriverTrackingOverview({ companyId }: { companyId: string }) {
  const { locale } = useLocale();
  const en = locale === "en";
  const [sessions, setSessions] = useState<TrackingSession[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/driver-tracking`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error("Unable to load tracking data");
      setSessions(payload.data as TrackingSession[]);
      setUpdatedAt(new Date());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadSessions();
    const interval = window.setInterval(() => { void loadSessions(); }, 30000);
    return () => window.clearInterval(interval);
  }, [loadSessions]);

  const formatDate = (date: string) => new Date(date).toLocaleString(en ? "en-US" : "ar-KW");
  const isOnline = (location: TrackingSession["lastLocation"]) => location ? Date.now() - new Date(location.receivedAt).getTime() <= 90_000 : false;
  const markerSessions = sessions.filter((item) => item.lastLocation);
  const markers: TrackingMapMarker[] = markerSessions.map((item) => ({ id: item.id, label: en ? item.driver.nameEn ?? item.driver.nameAr : item.driver.nameAr, latitude: item.lastLocation!.latitude, longitude: item.lastLocation!.longitude, recordedAt: item.lastLocation!.recordedAt }));

  if (loading) return <div className="page-container py-6 text-sm text-muted-foreground">{en ? "Loading tracking sessions..." : "جارٍ تحميل جلسات التتبع..."}</div>;

  return <div className="space-y-4">
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{updatedAt ? `${en ? "Last updated" : "آخر تحديث"}: ${updatedAt.toLocaleTimeString(en ? "en-US" : "ar-KW")}` : ""}</span><span>{en ? "Refreshes every 30 seconds" : "يتم التحديث كل 30 ثانية"}</span></div>
    {loadError && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{en ? "Could not refresh tracking data. It will retry automatically." : "تعذر تحديث بيانات التتبع. ستتم إعادة المحاولة تلقائيًا."}</CardContent></Card>}
    {sessions.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><MapPinned className="h-10 w-10 text-muted-foreground" /><div><h2 className="font-semibold">{en ? "No tracking sessions" : "لا توجد جلسات تتبع"}</h2><p className="mt-1 text-sm text-muted-foreground">{en ? "Driver locations will appear here when a tracking session starts." : "ستظهر مواقع السائقين هنا عند بدء جلسة تتبع."}</p></div></CardContent></Card> : <>
      <Card><CardContent className="p-3"><TrackingMap markers={markers} /></CardContent></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{sessions.map((item) => { const online = isOnline(item.lastLocation); const driverName = en ? item.driver.nameEn ?? item.driver.nameAr : item.driver.nameAr; return <Link key={item.id} href={`/dashboard/companies/${companyId}/driver-tracking/${item.id}`} className="block"><Card className="h-full transition-shadow hover:shadow-md"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4" />{driverName}</div><p className="mt-1 text-xs text-muted-foreground">{item.driver.accountType === "CAR_WASH_WORKER" ? (en ? "Car-wash worker" : "عامل غسيل") : (en ? "Driver" : "سائق")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[item.status]}`}>{item.status}</span></div><div className="space-y-2 text-sm text-muted-foreground"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4" />{en ? "Started" : "بدأت"}: {formatDate(item.startedAt)}</div><div className="flex items-center gap-2"><MapPinned className="h-4 w-4" />{item.lastLocation ? `${item.lastLocation.latitude.toFixed(5)}, ${item.lastLocation.longitude.toFixed(5)}` : (en ? "No location received" : "لم يُستلم موقع")}</div><div>{en ? "Last update" : "آخر تحديث"}: {item.lastLocation ? formatDate(item.lastLocation.recordedAt) : "—"}</div><div>{en ? "Points" : "النقاط"}: {item.pointCount}</div></div><div className={`flex items-center gap-1 text-xs font-medium ${online ? "text-emerald-700" : "text-muted-foreground"}`}><Radio className="h-3.5 w-3.5" />{online ? (en ? "Online" : "متصل") : (en ? "Offline" : "غير متصل")}</div></CardContent></Card></Link>; })}</div>
    </>}
  </div>;
}
