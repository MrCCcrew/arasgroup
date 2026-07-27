"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { readInvoiceImage, type InvoiceOcrResult } from "@/lib/delivery/invoice-ocr";

type Expense = { id: string; invoiceDate: string; amount: string | number; notes: string | null; imageUrl: string | null };
type FormState = { invoiceDate: string; amount: string; notes: string };

const emptyForm: FormState = { invoiceDate: "", amount: "", notes: "" };

async function readJson(response: Response) { const body = await response.text(); try { return body ? JSON.parse(body) : {}; } catch { return {}; } }

export default function PartnerExpensesPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ocr, setOcr] = useState<InvoiceOcrResult | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner-management/partner/expenses");
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "تعذر تحميل الفواتير");
      setExpenses(payload.data ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر تحميل الفواتير"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null); setPreview(null); setOcr(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) { setError("استخدم صورة JPG أو PNG أو WEBP فقط."); return; }
    if (selected.size > 10 * 1024 * 1024) { setError("حجم الصورة يتجاوز 10 ميجابايت."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setError(""); setFile(selected); setPreview(URL.createObjectURL(selected)); setOcr(null); void readInvoiceFile(selected);
  }

  async function readInvoiceFile(selected: File) {
    const file = selected;
    if (!file) { setError("اختر صورة الفاتورة أولًا."); return; }
    setReading(true); setError("");
    try {
      const result = await readInvoiceImage(file);
      setOcr(result);
      setForm((current) => ({
        ...current,
        amount: result.amount !== null ? result.amount.toFixed(3) : current.amount,
        invoiceDate: result.date ?? current.invoiceDate,
        notes: result.merchantName && !current.notes ? result.merchantName : current.notes,
      }));
    } catch (cause) { console.error("Partner invoice OCR failed:", cause); setError("تعذرت قراءة الفاتورة تلقائيًا. أدخل البيانات يدويًا."); } finally { setReading(false); }
  }

  async function readInvoice() { if (file) await readInvoiceFile(file); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!form.invoiceDate || !form.amount || Number(form.amount) <= 0) { setError("أدخل تاريخ الفاتورة والمبلغ قبل الحفظ."); return; }
    setSaving(true);
    try {
      const body = new FormData();
      if (file) body.append("file", file);
      body.append("invoiceDate", form.invoiceDate);
      body.append("amount", Number(form.amount).toFixed(3));
      if (form.notes.trim()) body.append("notes", form.notes.trim());
      if (ocr?.text) body.append("ocrRawText", ocr.text);
      const response = await fetch("/api/owner-management/partner/expenses", { method: "POST", body });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(payload.error || "تعذر حفظ الفاتورة");
      clearImage(); setForm(emptyForm); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "تعذر حفظ الفاتورة"); } finally { setSaving(false); }
  }

  const lowConfidence = ocr !== null && (ocr.confidence < 65 || ocr.amount === null || ocr.date === null);

  return <main dir="rtl" className="min-h-screen bg-muted/30 p-4 md:p-8"><section className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="text-2xl font-bold">فواتيري ومصروفاتي</h1><p className="text-sm text-muted-foreground">ارفع صورة الفاتورة ثم راجع نتيجة القراءة قبل الحفظ.</p></header>
    <form onSubmit={submit} className="space-y-4">
      <section className="section-card space-y-4"><h2 className="font-bold">صورة الفاتورة</h2>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={chooseFile} className="hidden" />
        {preview ? <div className="space-y-3"><img src={preview} alt="معاينة الفاتورة" className="max-h-80 w-full rounded border bg-white object-contain" /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => fileInput.current?.click()} className="rounded border px-4 py-2">تغيير الصورة</button><button type="button" onClick={readInvoice} disabled={reading} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{reading ? "جارٍ قراءة الفاتورة..." : "قراءة الفاتورة"}</button><button type="button" onClick={clearImage} className="rounded border border-destructive px-4 py-2 text-destructive">إزالة</button></div></div> : <button type="button" onClick={() => fileInput.current?.click()} className="w-full rounded border border-dashed p-8 text-sm">اختيار صورة فاتورة من الهاتف أو الكمبيوتر (JPG / PNG / WEBP)</button>}
      </section>

      {ocr && <section className="section-card space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">مراجعة قراءة الفاتورة</h2><span className="text-sm">الثقة: {ocr.confidence.toFixed(1)}%</span></div>{lowConfidence && <p className="rounded border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800">الثقة منخفضة أو توجد بيانات ناقصة. لم يتم تخمين أي قيمة؛ راجع الحقول وعدلها قبل الحفظ.</p>}<div className="grid gap-3 sm:grid-cols-2"><p><span className="text-muted-foreground">العملة: </span>{ocr.currency ?? "غير محددة"}</p><p><span className="text-muted-foreground">التاجر: </span>{ocr.merchantName ?? "غير محدد"}</p></div><details><summary className="cursor-pointer text-sm text-primary">النص الخام المستخرج</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs" dir="auto">{ocr.text || "لم يُستخرج نص"}</pre></details></section>}

      <section className="section-card grid gap-3 md:grid-cols-2"><div className="md:col-span-2"><h2 className="font-bold">بيانات المراجعة <span className="text-sm font-normal text-muted-foreground">(إدخال يدوي عند الحاجة)</span></h2></div><label className="grid gap-1 text-sm">تاريخ الفاتورة<input required type="date" value={form.invoiceDate} onChange={event => setForm({ ...form, invoiceDate: event.target.value })} className="rounded border p-2" /></label><label className="grid gap-1 text-sm">المبلغ (KWD)<input required min="0.001" step="0.001" type="number" placeholder="0.000" value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} className="rounded border p-2" dir="ltr" /></label><label className="grid gap-1 text-sm md:col-span-2">ملاحظات<textarea rows={3} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="rounded border p-2" /></label><div className="md:col-span-2"><button disabled={saving} className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">{saving ? "جارٍ الحفظ..." : "حفظ الفاتورة بعد المراجعة"}</button></div></section>
    </form>
    {error && <p role="alert" className="rounded border border-destructive p-3 text-destructive">{error}</p>}
    <section className="section-card overflow-x-auto"><h2 className="mb-3 font-bold">الفواتير السابقة</h2><table className="w-full text-right text-sm"><thead><tr className="border-b"><th className="p-2">التاريخ</th><th className="p-2">المبلغ</th><th className="p-2">ملاحظات</th></tr></thead><tbody>{loading ? <tr><td colSpan={3} className="p-4 text-center">جارٍ التحميل...</td></tr> : expenses.length === 0 ? <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">لا توجد فواتير.</td></tr> : expenses.map(item => <tr key={item.id} className="border-b"><td className="p-2">{new Date(item.invoiceDate).toLocaleDateString("en-CA")}</td><td className="p-2">{Number(item.amount).toFixed(3)}</td><td className="p-2">{item.notes || "—"}</td></tr>)}</tbody></table></section>
    <Link className="text-primary underline" href="/partner">العودة للبوابة</Link>
  </section></main>;
}
