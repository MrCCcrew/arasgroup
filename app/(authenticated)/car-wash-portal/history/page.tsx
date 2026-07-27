"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";

type Movement = { id: string; kind: "EXPENSE" | "CASH" | "KNET"; date: string; amount: number; vehicle: { id: string; code: string; nameAr: string; nameEn: string | null }; category: { id: string; nameAr: string; nameEn: string | null } | null; paymentMethod: string | null; imageUrl: string | null; notes: string | null; source: string; createdBy: { id: string; nameAr: string | null; nameEn: string | null; email: string } | null };
type FormData = { vehicles: Array<{ id: string; code: string; nameAr: string; nameEn: string | null }> };

export default function CarWashPortalHistoryPage() {
  const { locale } = useLocale();
  const english = locale === "en";
  const t = (ar: string, en: string) => (english ? en : ar);
  const [items, setItems] = useState<Movement[]>([]);
  const [vehicles, setVehicles] = useState<FormData["vehicles"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ from: "", to: "", vehicleId: "", kind: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
      const response = await fetch(`/api/car-wash-portal/movements?${query.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error ?? "Unable to load movements");
      setItems(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("تعذر تحميل السجل", "Unable to load history"));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch("/api/car-wash-portal/form-data", { cache: "no-store" }).then((response) => response.json()).then((payload) => { if (payload.success) setVehicles(payload.data.vehicles); }).catch(() => undefined);
  }, []);

  return <div className="space-y-4" dir={english ? "ltr" : "rtl"}>
    <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold">{t("سجل الحركات", "Movement history")}</h1><p className="text-sm text-slate-600">{t("المصروفات والإيرادات المسجلة من البوابة", "Portal expenses and revenues")}</p></div><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />{t("تحديث", "Refresh")}</button></div>
    <div className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-4"><input type="date" aria-label={t("من تاريخ", "From date")} value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className="rounded border p-2 text-sm" /><input type="date" aria-label={t("إلى تاريخ", "To date")} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className="rounded border p-2 text-sm" /><select value={filters.vehicleId} onChange={(event) => setFilters({ ...filters, vehicleId: event.target.value })} className="rounded border p-2 text-sm"><option value="">{t("كل السيارات", "All vehicles")}</option>{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.code} — {english ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}</option>)}</select><select value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })} className="rounded border p-2 text-sm"><option value="">{t("كل الحركات", "All movements")}</option><option value="EXPENSE">{t("مصروف", "Expense")}</option><option value="CASH">CASH</option><option value="KNET">KNET</option></select></div>
    {loading ? <div className="rounded-xl border bg-white p-5 text-sm text-slate-600">{t("جارٍ التحميل...", "Loading...")}</div> : error ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : items.length === 0 ? <div className="rounded-xl border bg-white p-5 text-sm text-slate-600">{t("لا توجد حركات مطابقة.", "No matching movements.")}</div> : <div className="space-y-3">{items.map((item) => <article key={`${item.kind}-${item.id}`} className="rounded-xl border bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.kind === "EXPENSE" ? t("مصروف", "Expense") : item.kind} · {item.vehicle.code}</p><p className="text-sm text-slate-600">{item.category ? (english ? item.category.nameEn ?? item.category.nameAr : item.category.nameAr) : item.paymentMethod ?? "-"}</p></div><p className="font-bold" dir="ltr">{item.amount.toFixed(3)} KWD</p></div><div className="mt-3 grid gap-1 text-xs text-slate-500"><p dir="ltr">{new Date(item.date).toLocaleDateString("en-CA")}</p>{item.notes && <p>{item.notes}</p>}{item.createdBy && <p>{t("بواسطة", "By")}: {english ? item.createdBy.nameEn ?? item.createdBy.nameAr ?? item.createdBy.email : item.createdBy.nameAr ?? item.createdBy.nameEn ?? item.createdBy.email}</p>}</div>{item.imageUrl && <img src={item.imageUrl} alt={t("صورة الحركة", "Movement image")} className="mt-3 max-h-48 w-full rounded object-contain" />}</article>)}</div>}
  </div>;
}
