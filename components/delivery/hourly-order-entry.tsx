"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";

export function HourlyOrderEntry({ companyId, contractId, date, drivers }: { companyId: string; contractId: string; date: string; drivers: { id: string; name: string }[] }) {
  const { locale } = useLocale(); const en = locale === "en";
  const t = (ar: string, english: string) => en ? english : ar;
  const [entities, setEntities] = useState<{ id: string; name: string; hourlyRate: string | null; isActive: boolean }[]>([]);
  const [defaultRate, setDefaultRate] = useState("");
  const [driverId, setDriverId] = useState(""); const [entityId, setEntityId] = useState("");
  const [hours, setHours] = useState(""); const [minutes, setMinutes] = useState("0");
  const [orders, setOrders] = useState("0"); const [rate, setRate] = useState(""); const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const base = `/api/delivery/contracts/${contractId}/hourly`;
  const management = `/dashboard/companies/${companyId}/delivery/contracts/${contractId}/hourly`;
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    fetch(`${base}?month=${date.slice(0, 7)}`, { signal: controller.signal }).then(response => response.json()).then(body => {
      if (!body.success) throw new Error(body.error || "تعذر تحميل جهات العمل");
      if (body.data.contract.companyId !== companyId) throw new Error("العقد لا يتبع الشركة");
      setEntities(body.data.entities.filter((entity: { isActive: boolean }) => entity.isActive));
      setDefaultRate(body.data.contract.defaultHourlyRate ?? "");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base, companyId, date]);
  const effectiveRate = rate || entities.find(entity => entity.id === entityId)?.hourlyRate || defaultRate;
  const duration = Number(hours || 0) * 60 + Number(minutes);
  async function save() {
    setError(""); setSuccess("");
    if (!driverId || !entityId || !date || hours === "" || !Number.isInteger(Number(hours)) || Number(hours) < 0 || !Number.isInteger(Number(minutes)) || Number(minutes) < 0 || Number(minutes) > 59 || duration < 1 || duration > 1440 || !Number.isInteger(Number(orders)) || Number(orders) < 0 || Number(orders) > 100000 || !Number.isFinite(Number(effectiveRate)) || Number(effectiveRate) <= 0) {
      setError(t("راجع السائق والجهة والتاريخ والساعات وعدد الأوردرات وسعر الساعة", "Check driver, entity, date, hours, orders and hourly rate")); return;
    }
    if (saving) return; setSaving(true);
    try {
      const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "entry", driverId, workEntityId: entityId, date, minutes: duration, ordersCount: Number(orders), ...(rate ? { hourlyRate: Number(rate) } : {}), notes }) });
      const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error || "تعذر الحفظ");
      setSuccess(`${t("تم حفظ ساعات السائق بنجاح. المستحق", "Driver hours saved. Amount")}: ${Number(body.data.amount).toFixed(3)} ${t("د.ك", "KWD")}`);
      setHours(""); setMinutes("0"); setOrders("0"); setNotes("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ"); } finally { setSaving(false); }
  }
  return <section className="section-card space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{t("تسجيل شغل السائق بالساعة", "Record hourly driver work")}</h3><Link href={management} className="text-sm text-primary underline">{t("جهات العمل وسجل الساعات", "Work entities & hours log")}</Link></div>
    <p className="text-sm text-muted-foreground">{t("المستحق = الساعات × سعر الساعة. عدد الأوردرات للمتابعة فقط ولا يؤثر على المستحق.", "Amount = hours × hourly rate. Orders are for tracking only and do not affect the amount.")}</p>
    {loading ? <p>{t("جارٍ تحميل الجهات…", "Loading entities…")}</p> : !entities.length ? <p className="rounded bg-amber-50 p-3">{t("أضف جهة عمل نشطة مثل eyed من", "Add an active work entity such as eyed from")} <Link className="text-primary underline" href={management}>{t("إعدادات جهات العمل", "work entity settings")}</Link></p> : null}
    <fieldset disabled={loading || saving || !entities.length} className="grid gap-4 md:grid-cols-3 disabled:opacity-60">
      <label>{t("السائق", "Driver")}<select className="input-field mt-1 w-full" value={driverId} onChange={event => setDriverId(event.target.value)}><option value="">{t("اختر السائق", "Select driver")}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
      <label>{t("جهة العمل", "Work entity")}<select className="input-field mt-1 w-full" value={entityId} onChange={event => { setEntityId(event.target.value); setRate(""); }}><option value="">{t("اختر الجهة", "Select entity")}</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
      <label>{t("سعر الساعة (د.ك)", "Hourly rate (KWD)")}<input type="number" min="0.001" max="100000" step="0.001" className="input-field mt-1 w-full" placeholder={String(effectiveRate)} value={rate} onChange={event => setRate(event.target.value)} /></label>
      <label>{t("عدد الساعات", "Hours")}<input type="number" min="0" max="24" step="1" className="input-field mt-1 w-full" value={hours} onChange={event => setHours(event.target.value)} /></label>
      <label>{t("الدقائق", "Minutes")}<input type="number" min="0" max="59" step="1" className="input-field mt-1 w-full" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
      <label>{t("عدد الأوردرات (للمتابعة فقط)", "Orders (tracking only)")}<input type="number" min="0" max="100000" step="1" className="input-field mt-1 w-full" value={orders} onChange={event => setOrders(event.target.value)} /></label>
      <label className="md:col-span-3">{t("ملاحظات", "Notes")}<input maxLength={4000} className="input-field mt-1 w-full" value={notes} onChange={event => setNotes(event.target.value)} /></label>
      <p className="font-bold md:col-span-2">{t("المستحق", "Amount")}: {(Number(effectiveRate || 0) * duration / 60 || 0).toFixed(3)} {t("د.ك", "KWD")}</p>
      <button type="button" onClick={() => void save()} className="btn-primary rounded px-4 py-2">{saving ? t("جارٍ الحفظ…", "Saving…") : t("حفظ شغل السائق بالساعة", "Save hourly driver work")}</button>
    </fieldset>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-700">{error}</p>}
    {success && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-700">{success} · <Link href={management} className="underline">{t("عرض السجل", "View log")}</Link></p>}
  </section>;
}
