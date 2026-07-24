"use client";

import dynamic from "next/dynamic";
import { useLocale } from "@/components/providers/locale-provider";
import type { MapPoint, TrackingMapMarker } from "./tracking-map";

const TrackingMap = dynamic(() => import("./tracking-map").then((module) => module.TrackingMap), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-lg bg-muted" /> });

export interface DetailPoint extends MapPoint { id: string; recordedAt: string; accuracy: number | null; speed: number | null; receivedAt: string; }

export function DriverTrackingDetail({ driverName, points }: { driverName: string; points: DetailPoint[] }) {
  const { locale } = useLocale();
  const en = locale === "en";
  const latest = points.at(-1);
  const marker: TrackingMapMarker[] = latest ? [{ id: latest.id, label: driverName, latitude: latest.latitude, longitude: latest.longitude, recordedAt: latest.recordedAt }] : [];
  const date = (value: string) => new Date(value).toLocaleString(en ? "en-US" : "ar-KW");
  return <div className="space-y-4">
    <TrackingMap markers={marker} route={points} />
    {points.length === 0 ? <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">{en ? "No points were received for this session." : "لم تُستلم نقاط لهذه الجلسة."}</p> : <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-4 py-3 text-start">{en ? "Time" : "الوقت"}</th><th className="px-4 py-3 text-start">{en ? "Location" : "الموقع"}</th><th className="px-4 py-3 text-start">{en ? "Accuracy" : "الدقة"}</th><th className="px-4 py-3 text-start">{en ? "Speed" : "السرعة"}</th></tr></thead><tbody>{[...points].reverse().map((point) => <tr key={point.id} className="border-t"><td className="px-4 py-3">{date(point.recordedAt)}</td><td className="px-4 py-3" dir="ltr">{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</td><td className="px-4 py-3">{point.accuracy == null ? "—" : `${point.accuracy.toFixed(1)} m`}</td><td className="px-4 py-3">{point.speed == null ? "—" : `${point.speed.toFixed(1)} m/s`}</td></tr>)}</tbody></table></div>}
  </div>;
}
