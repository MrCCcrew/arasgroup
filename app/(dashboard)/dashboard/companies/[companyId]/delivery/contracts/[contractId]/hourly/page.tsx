"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

type Entity = { id: string; name: string; hourlyRate: string | null; isActive: boolean };
type Driver = { id: string; employee: { nameAr: string; nameEn?: string | null; employeeNumber?: string | null } };
type Entry = { id: string; driverId: string; workEntityId: string; date: string; minutes: number; ordersCount: number; hourlyRate: string; amount: string; notes: string | null; driver: Driver; workEntity: { name: string } };
type Data = { contract: { companyId: string; nameAr: string; defaultHourlyRate: string | null; usesHourlyWork: boolean; isActive: boolean }; entities: Entity[]; entries: Entry[]; total: number; totalMinutes: number; totalOrders: number; totalAmount: string };
const today = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; };
const emptyEntry = () => ({ id: "", driverId: "", workEntityId: "", date: today(), hours: "", minutes: "0", ordersCount: "0", hourlyRate: "", notes: "" });

export default function HourlyWorkPage() {
  const { companyId, contractId } = useParams<{ companyId: string; contractId: string }>();
  const { locale } = useLocale(); const en = locale === "en";
  const [data, setData] = useState<Data | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [driverFilter, setDriverFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [entityForm, setEntityForm] = useState({ id: "", name: "", hourlyRate: "", isActive: true });
  const [entryForm, setEntryForm] = useState(emptyEntry);
  const base = `/api/delivery/contracts/${contractId}/hourly`;
  const text = (ar: string, english: string) => en ? english : ar;
  const name = (driver: Driver) => en ? driver.employee.nameEn || driver.employee.nameAr : driver.employee.nameAr;

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ month, page: String(page), ...(driverFilter ? { driverId: driverFilter } : {}), ...(entityFilter ? { workEntityId: entityFilter } : {}) });
      const response = await fetch(`${base}?${query}`, { signal });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Failed to load");
      if (body.data.contract.companyId !== companyId) throw new Error("العقد لا يتبع هذه الشركة");
      setData(body.data);
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "تعذر التحميل"); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [base, companyId, month, page, driverFilter, entityFilter]);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/delivery/drivers?companyId=${companyId}`, { signal: controller.signal }).then(response => response.json()).then(body => {
      if (!body.success) throw new Error(body.error || "تعذر تحميل السائقين");
      setDrivers(body.data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [companyId]);

  async function mutate(payload: object, done?: () => void) {
    if (saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "تعذر الحفظ");
      done?.(); setMessage(text("تم الحفظ بنجاح", "Saved successfully")); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر الحفظ"); }
    finally { setSaving(false); }
  }
  const defaultRate = data?.contract.defaultHourlyRate ?? "";
  const selectedEntity = data?.entities.find(entity => entity.id === entryForm.workEntityId);
  const effectiveRate = entryForm.hourlyRate || selectedEntity?.hourlyRate || defaultRate;
  const totalMinutes = Number(entryForm.hours || 0) * 60 + Number(entryForm.minutes || 0);
  const previewAmount = Number(effectiveRate || 0) * totalMinutes / 60;
  const enabled = !!data?.contract.usesHourlyWork && data.contract.isActive;

  return <div>
    <Header companyId={companyId} title={text("العمل بالساعة وجهات العمل", "Hourly work & entities")} subtitle={data?.contract.nameAr ?? ""} />
    <div className="page-container space-y-5">
      <Link className="text-primary underline" href={`/dashboard/companies/${companyId}/delivery/contracts`}>{text("العودة للعقود", "Back to contracts")}</Link>
      <p className="text-sm text-muted-foreground">{text("سجّل جهة العمل الفعلية لكل سائق تحت العقد، مثل eyed تحت عقد روبوبس. المستحق = الساعات × سعر الساعة؛ عدد الأوردرات للمتابعة فقط.", "Track each driver's actual work entity under the contract. Amount = hours × hourly rate; orders are for tracking only.")}</p>
      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p role="status" className="rounded bg-emerald-50 p-3 text-emerald-700">{message}</p>}
      {data && !enabled && <p className="rounded bg-amber-50 p-3">{text("العقد غير نشط أو نظام الساعات غير مفعّل. السجلات السابقة متاحة للعرض.", "The contract is inactive or hourly work is disabled. Existing records remain available.")}</p>}
      <section className="section-card space-y-4">
        <h2 className="font-bold">{text("جهات العمل تحت العقد", "Work entities under this contract")}</h2>
        <form className="grid items-end gap-3 md:grid-cols-4" onSubmit={event => { event.preventDefault(); void mutate({ action: "entity", ...entityForm, id: entityForm.id || undefined, hourlyRate: entityForm.hourlyRate ? Number(entityForm.hourlyRate) : null }, () => setEntityForm({ id: "", name: "", hourlyRate: "", isActive: true })); }}>
          <label>{text("اسم الجهة", "Entity name")}<input required maxLength={191} className="input-field mt-1 w-full" placeholder="eyed" value={entityForm.name} onChange={event => setEntityForm({ ...entityForm, name: event.target.value })} /></label>
          <label>{text("سعر الساعة (اختياري)", "Hourly rate (optional)")}<input type="number" min="0.001" max="100000" step="0.001" className="input-field mt-1 w-full" placeholder={String(defaultRate)} value={entityForm.hourlyRate} onChange={event => setEntityForm({ ...entityForm, hourlyRate: event.target.value })} /></label>
          <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={entityForm.isActive} onChange={event => setEntityForm({ ...entityForm, isActive: event.target.checked })} />{text("جهة نشطة", "Active entity")}</label>
          <div className="flex gap-2"><button disabled={saving || !enabled} className="btn-primary rounded px-3 py-2 disabled:opacity-50">{entityForm.id ? text("حفظ التعديل", "Save changes") : text("إضافة جهة", "Add entity")}</button>{entityForm.id && <button type="button" className="rounded border px-3" onClick={() => setEntityForm({ id: "", name: "", hourlyRate: "", isActive: true })}>{text("إلغاء", "Cancel")}</button>}</div>
        </form>
        <p className="text-xs text-muted-foreground">{text("اترك السعر فارغًا لاستخدام سعر العقد. تغيير الأسعار لا يغيّر الساعات المسجلة سابقًا.", "Leave the rate blank to use the contract rate. Rate changes do not change existing work records.")}</p>
        <div className="flex flex-wrap gap-2">{data?.entities.map(entity => <button key={entity.id} disabled={saving || !enabled} className="rounded border px-3 py-2 text-sm" onClick={() => setEntityForm({ id: entity.id, name: entity.name, hourlyRate: entity.hourlyRate ?? "", isActive: entity.isActive })}>{entity.name} · {Number(entity.hourlyRate ?? defaultRate).toFixed(3)} {text("د.ك/ساعة", "KWD/hour")} {!entity.isActive && text("(موقوفة)", "(inactive)")} · {text("تعديل", "Edit")}</button>)}</div>
      </section>

      <section className="section-card space-y-4" id="hourly-entry-form">
        <h2 className="font-bold">{entryForm.id ? text("تعديل سجل الساعات", "Edit work record") : text("تسجيل ساعات سائق", "Record driver hours")}</h2>
        <form className="grid gap-3 md:grid-cols-3" onSubmit={event => {
          event.preventDefault();
          if (!Number.isInteger(totalMinutes) || totalMinutes < 1 || totalMinutes > 1440) { setError(text("أدخل مدة صحيحة حتى 24 ساعة", "Enter a valid duration up to 24 hours")); return; }
          void mutate({ action: "entry", id: entryForm.id || undefined, driverId: entryForm.driverId, workEntityId: entryForm.workEntityId, date: entryForm.date, minutes: totalMinutes, ordersCount: Number(entryForm.ordersCount), ...(entryForm.hourlyRate ? { hourlyRate: Number(entryForm.hourlyRate) } : {}), notes: entryForm.notes }, () => setEntryForm(emptyEntry()));
        }}>
          <label>{text("السائق", "Driver")}<select required className="input-field mt-1 w-full" value={entryForm.driverId} onChange={event => setEntryForm({ ...entryForm, driverId: event.target.value })}><option value="">{text("اختر السائق", "Select driver")}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{name(driver)} {driver.employee.employeeNumber ? `(${driver.employee.employeeNumber})` : ""}</option>)}</select></label>
          <label>{text("جهة العمل", "Work entity")}<select required className="input-field mt-1 w-full" value={entryForm.workEntityId} onChange={event => setEntryForm({ ...entryForm, workEntityId: event.target.value, hourlyRate: "" })}><option value="">{text("اختر الجهة", "Select entity")}</option>{data?.entities.filter(entity => entity.isActive || entity.id === entryForm.workEntityId).map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
          <label>{text("التاريخ", "Date")}<input type="date" required className="input-field mt-1 w-full" value={entryForm.date} onChange={event => setEntryForm({ ...entryForm, date: event.target.value })} /></label>
          <div className="grid grid-cols-2 gap-2"><label>{text("ساعات", "Hours")}<input type="number" required min="0" max="24" step="1" className="input-field mt-1 w-full" value={entryForm.hours} onChange={event => setEntryForm({ ...entryForm, hours: event.target.value })} /></label><label>{text("دقائق", "Minutes")}<input type="number" required min="0" max="59" step="1" className="input-field mt-1 w-full" value={entryForm.minutes} onChange={event => setEntryForm({ ...entryForm, minutes: event.target.value })} /></label></div>
          <label>{text("عدد الأوردرات (للمتابعة فقط)", "Orders (tracking only)")}<input type="number" required min="0" max="100000" step="1" className="input-field mt-1 w-full" value={entryForm.ordersCount} onChange={event => setEntryForm({ ...entryForm, ordersCount: event.target.value })} /></label>
          <label>{text("سعر الساعة (د.ك)", "Hourly rate (KWD)")}<input type="number" min="0.001" max="100000" step="0.001" className="input-field mt-1 w-full" placeholder={String(selectedEntity?.hourlyRate ?? defaultRate)} value={entryForm.hourlyRate} onChange={event => setEntryForm({ ...entryForm, hourlyRate: event.target.value })} /></label>
          <label className="md:col-span-3">{text("ملاحظات", "Notes")}<input maxLength={4000} className="input-field mt-1 w-full" value={entryForm.notes} onChange={event => setEntryForm({ ...entryForm, notes: event.target.value })} /></label>
          <p className="font-bold md:col-span-2">{text("قيمة الشغل", "Work amount")}: {Number.isFinite(previewAmount) ? previewAmount.toFixed(3) : "0.000"} {text("د.ك", "KWD")}</p>
          <div className="flex gap-2"><button disabled={saving || !enabled} className="btn-primary rounded px-4 py-2 disabled:opacity-50">{saving ? text("جارٍ الحفظ…", "Saving…") : text("حفظ الساعات", "Save hours")}</button>{entryForm.id && <button type="button" className="rounded border px-3" onClick={() => setEntryForm(emptyEntry())}>{text("إلغاء", "Cancel")}</button>}</div>
        </form>
      </section>

      <section className="section-card space-y-4">
        <h2 className="font-bold">{text("سجل الساعات والمستحق", "Hours & amounts")}</h2>
        <div className="grid gap-3 md:grid-cols-3"><label>{text("الشهر", "Month")}<input type="month" className="input-field mt-1 w-full" value={month} onChange={event => { setMonth(event.target.value); setPage(1); }} /></label><label>{text("السائق", "Driver")}<select className="input-field mt-1 w-full" value={driverFilter} onChange={event => { setDriverFilter(event.target.value); setPage(1); }}><option value="">{text("كل السائقين", "All drivers")}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{name(driver)}</option>)}</select></label><label>{text("جهة العمل", "Work entity")}<select className="input-field mt-1 w-full" value={entityFilter} onChange={event => { setEntityFilter(event.target.value); setPage(1); }}><option value="">{text("كل الجهات", "All entities")}</option>{data?.entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label></div>
        <div className="grid gap-3 sm:grid-cols-3"><p className="rounded bg-muted p-3">{text("إجمالي الساعات", "Total hours")}: {((data?.totalMinutes ?? 0) / 60).toFixed(2)}</p><p className="rounded bg-muted p-3">{text("إجمالي الأوردرات", "Total orders")}: {data?.totalOrders ?? 0}</p><p className="rounded bg-muted p-3">{text("إجمالي المستحق", "Total amount")}: {Number(data?.totalAmount ?? 0).toFixed(3)} {text("د.ك", "KWD")}</p></div>
        <p className="text-xs text-muted-foreground">{text("هذه قيمة الشغل المسجل للمراجعة مع العقد، ولا تُرحّل تلقائيًا إلى القيود أو الرواتب.", "Recorded work amounts are available for contract review and are not automatically posted to journals or payroll.")}</p>
        {loading ? <p>{text("جارٍ التحميل…", "Loading…")}</p> : <div className="overflow-x-auto"><table className="ar-table"><thead><tr>{[text("التاريخ", "Date"), text("السائق", "Driver"), text("الجهة", "Entity"), text("المدة", "Duration"), text("الأوردرات", "Orders"), text("سعر الساعة", "Hourly rate"), text("المستحق", "Amount"), text("ملاحظات", "Notes"), ""].map((label, index) => <th key={index}>{label}</th>)}</tr></thead><tbody>{data?.entries.map(entry => <tr key={entry.id}><td>{entry.date.slice(0, 10)}</td><td>{name(entry.driver)}</td><td>{entry.workEntity.name}</td><td dir="ltr">{Math.floor(entry.minutes / 60)}:{String(entry.minutes % 60).padStart(2, "0")}</td><td>{entry.ordersCount}</td><td>{Number(entry.hourlyRate).toFixed(3)}</td><td>{Number(entry.amount).toFixed(3)}</td><td className="max-w-xs break-words">{entry.notes || "—"}</td><td><div className="flex gap-2"><button disabled={saving || !enabled} className="text-primary underline" onClick={() => { setEntryForm({ id: entry.id, driverId: entry.driverId, workEntityId: entry.workEntityId, date: entry.date.slice(0, 10), hours: String(Math.floor(entry.minutes / 60)), minutes: String(entry.minutes % 60), ordersCount: String(entry.ordersCount), hourlyRate: entry.hourlyRate, notes: entry.notes ?? "" }); document.getElementById("hourly-entry-form")?.scrollIntoView({ behavior: "smooth" }); }}>{text("تعديل", "Edit")}</button><button disabled={saving || !enabled} className="text-destructive underline" onClick={() => { if (window.confirm(text("حذف سجل الساعات؟", "Delete this work record?"))) void mutate({ action: "deleteEntry", id: entry.id }); }}>{text("حذف", "Delete")}</button></div></td></tr>)}{!data?.entries.length && <tr><td colSpan={9} className="py-6 text-center">{text("لا توجد ساعات مسجلة للفترة", "No work records for this period")}</td></tr>}</tbody></table></div>}
        <div className="flex items-center justify-between"><button className="rounded border px-3 py-2 disabled:opacity-50" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>{text("السابق", "Previous")}</button><span>{page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 50))}</span><button className="rounded border px-3 py-2 disabled:opacity-50" disabled={loading || page * 50 >= (data?.total ?? 0)} onClick={() => setPage(page + 1)}>{text("التالي", "Next")}</button></div>
      </section>
    </div>
  </div>;
}
