"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { readInvoiceImage } from "@/lib/delivery/invoice-ocr";
import { useLocale } from "@/components/providers/locale-provider";

type Data = {
  vehicles: Array<{ id: string; code: string; nameAr: string; nameEn: string | null }>;
  categories: Array<{ id: string; nameAr: string; nameEn: string | null; type: string; code: string | null }>;
};

export function PortalMovementForm({ expense }: { expense: boolean }) {
  const { locale } = useLocale();
  const router = useRouter();
  const english = locale === "en";
  const t = (ar: string, en: string) => (english ? en : ar);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [form, setForm] = useState({ vehicleId: "", categoryId: "", kind: "CASH", date: new Date().toISOString().slice(0, 10), amount: "", notes: "", transactionReference: "" });

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(() => {
    fetch("/api/car-wash-portal/form-data")
      .then((response) => response.json())
      .then((payload) => {
        if (!payload.success) throw new Error(payload.error);
        setData(payload.data);
        if (payload.data.vehicles.length === 1) setForm((current) => ({ ...current, vehicleId: payload.data.vehicles[0].id }));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : t("تعذر تحميل البيانات", "Unable to load data")));
  }, []);

  async function processImage(file?: File) {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError(t("الصورة غير صالحة أو أكبر من الحجم المسموح", "Invalid or oversized image"));
      return;
    }
    setPreview(URL.createObjectURL(file));
    setReading(true);
    try {
      const result = await readInvoiceImage(file);
      setForm((current) => ({ ...current, amount: result.amount?.toFixed(3) ?? current.amount, date: result.date ?? current.date, notes: current.notes || result.merchantName || "" }));
    } catch {
      setError(t("تعذرت قراءة الصورة", "OCR could not read the image"));
    } finally {
      setReading(false);
    }
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Allows selecting the same image again from either source.
    event.target.value = "";
    void processImage(file);
  }

  function removeImage() {
    setPreview(null);
    if (cameraInput.current) cameraInput.current.value = "";
    if (galleryInput.current) galleryInput.current.value = "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setOk("");
    if (!form.vehicleId || !form.amount || (expense && !form.categoryId)) {
      setError(t("أكمل الحقول المطلوبة", "Complete required fields"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/car-wash-portal/movements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: expense ? "EXPENSE" : form.kind, vehicleId: form.vehicleId, categoryId: expense ? form.categoryId : undefined, amount: Number(form.amount), date: form.date, notes: form.notes, transactionReference: form.transactionReference || undefined }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setOk(t("تم حفظ الحركة", "Movement saved"));
      setForm((current) => ({ ...current, amount: "", notes: "", transactionReference: "" }));
      removeImage();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("فشل الحفظ", "Save failed"));
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <p>{error || t("جارٍ التحميل...", "Loading...")}</p>;
  const category = data.categories.find((item) => item.id === form.categoryId);
  const water = category?.type.toLowerCase() === "water" || category?.code?.toLowerCase() === "water";
  const needsImageControl = !expense || !water;

  return <form onSubmit={submit} className="space-y-4 rounded-xl border bg-white p-4" dir={english ? "ltr" : "rtl"}>
    {error && <p className="text-red-600">{error}</p>}{ok && <p className="text-green-600">{ok}</p>}
    <label>{t("السيارة", "Vehicle")}<select required value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })} className="input-field w-full"><option value="">{t("اختر", "Select")}</option>{data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} — {english ? vehicle.nameEn ?? vehicle.nameAr : vehicle.nameAr}</option>)}</select></label>
    {expense ? <label>{t("نوع المصروف", "Expense type")}<select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="input-field w-full"><option value="">{t("اختر", "Select")}</option>{data.categories.map((item) => <option key={item.id} value={item.id}>{english ? item.nameEn ?? item.nameAr : item.nameAr}</option>)}</select></label> : <label>{t("نوع الإيراد", "Revenue type")}<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })} className="input-field w-full"><option value="CASH">CASH</option><option value="KNET">KNET</option></select></label>}
    <label>{t("التاريخ", "Date")}<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="input-field w-full" /></label>
    <label>{t("المبلغ", "Amount")}<input required type="number" step="0.001" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="input-field w-full" /></label>
    {!expense && form.kind === "KNET" && <label>{t("مرجع العملية", "Transaction reference")}<input value={form.transactionReference} onChange={(event) => setForm({ ...form, transactionReference: event.target.value })} className="input-field w-full" /></label>}
    <label>{t("ملاحظات", "Notes")}<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="input-field w-full" /></label>
    {needsImageControl && <>
      <input ref={cameraInput} className="hidden" type="file" accept="image/*" capture="environment" onChange={handleImageChange} />
      <input ref={galleryInput} className="hidden" type="file" accept="image/*" onChange={handleImageChange} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => cameraInput.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded border p-3"><Camera size={18} />{t("التقاط صورة", "Take Photo")}</button>
        <button type="button" onClick={() => galleryInput.current?.click()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded border p-3"><ImagePlus size={18} />{t("اختيار من المعرض", "Choose from Gallery")}</button>
      </div>
      {preview && <div className="space-y-2"><img src={preview} alt={t("معاينة الصورة", "Image preview")} className="max-h-56 w-full rounded object-contain" /><div className="flex gap-2"><button type="button" onClick={removeImage} className="inline-flex items-center gap-1 rounded border border-red-200 px-3 py-2 text-sm text-red-700"><Trash2 size={15} />{t("حذف الصورة", "Remove image")}</button></div></div>}
      {reading && <p>{t("جارٍ قراءة الصورة...", "Reading image...")}</p>}
    </>}
    <button disabled={saving || reading} className="w-full rounded bg-primary p-3 text-primary-foreground">{saving ? t("جارٍ الحفظ...", "Saving...") : t("حفظ", "Save")}</button>
  </form>;
}
