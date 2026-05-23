"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Plus, Save, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Vehicle { id: string; code: string; nameAr: string; nameEn: string | null }
interface Location { id: string; nameAr: string; nameEn: string | null }

interface RevenueRow { id: number; type: "CASH" | "KNET"; amount: string; description: string }
interface ExpenseRow { id: number; amount: string; description: string }

let nextId = 1;

export default function NewCarWashOperationPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const router = useRouter();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [revenues, setRevenues] = useState<RevenueRow[]>([
    { id: nextId++, type: "CASH", amount: "", description: "" },
  ]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/car-wash/vehicles?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/car-wash/locations?companyId=${companyId}`).then((r) => r.json()),
    ]).then(([vp, lp]) => {
      if (vp.success) { setVehicles(vp.data); if (vp.data[0]) setVehicleId(vp.data[0].id); }
      if (lp.success) { setLocations(lp.data); if (lp.data[0]) setLocationId(lp.data[0].id); }
      if (!vp.success || !lp.success) setLoadError(locale === "en" ? "Failed to load form data" : "تعذر تحميل بيانات النموذج");
    }).catch(() => setLoadError(locale === "en" ? "Failed to load form data" : "تعذر تحميل بيانات النموذج"));
  }, [companyId, locale]);

  // ── Revenue rows ──────────────────────────────────────────────────────────
  function addRevenue() {
    setRevenues((prev) => [...prev, { id: nextId++, type: "CASH", amount: "", description: "" }]);
  }
  function removeRevenue(id: number) {
    setRevenues((prev) => prev.filter((r) => r.id !== id));
  }
  function setRevField<K extends keyof RevenueRow>(id: number, key: K, value: RevenueRow[K]) {
    setRevenues((prev) => prev.map((r) => r.id === id ? { ...r, [key]: value } : r));
  }

  // ── Expense rows ──────────────────────────────────────────────────────────
  function addExpense() {
    setExpenses((prev) => [...prev, { id: nextId++, amount: "", description: "" }]);
  }
  function removeExpense(id: number) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }
  function setExpField<K extends keyof ExpenseRow>(id: number, key: K, value: ExpenseRow[K]) {
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, [key]: value } : e));
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalCash = revenues.filter((r) => r.type === "CASH").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalKnet = revenues.filter((r) => r.type === "KNET").reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExp  = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const net = totalCash + totalKnet - totalExp;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!vehicleId) { setError(locale === "en" ? "Select a vehicle" : "اختر السيارة"); return; }
    if (!locationId) { setError(locale === "en" ? "Select a location" : "اختر الموقع"); return; }
    if (revenues.length === 0) { setError(locale === "en" ? "Add at least one revenue entry" : "أضف إيراداً واحداً على الأقل"); return; }

    const revenuePayload = revenues
      .filter((r) => parseFloat(r.amount) > 0)
      .map((r) => ({ type: r.type, amount: parseFloat(r.amount), description: r.description || undefined }));

    const expensePayload = expenses
      .filter((e) => parseFloat(e.amount) > 0 && e.description.trim())
      .map((e) => ({ amount: parseFloat(e.amount), description: e.description }));

    if (revenuePayload.length === 0) {
      setError(locale === "en" ? "At least one revenue must have a valid amount" : "يجب أن يكون لإيراد واحد على الأقل مبلغ صحيح");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/car-wash/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          vehicleId,
          locationId,
          date,
          revenues: revenuePayload,
          expenses: expensePayload,
          notes: notes || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      router.push(`/dashboard/companies/${companyId}/car-wash/operations`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setSaving(false);
    }
  }

  const ar = locale !== "en";

  return (
    <div>
      <Header
        title={ar ? "عملية غسيل جديدة" : "New Car Wash Operation"}
        subtitle={ar ? "تسجيل إيرادات ومصروفات يوم العمل" : "Record daily revenues and expenses"}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl">
        <Link
          href={`/dashboard/companies/${companyId}/car-wash/operations`}
          className="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {ar ? "العودة للعمليات" : "Back to operations"}
        </Link>

        {loadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Basic info */}
          <div className="section-card grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "السيارة" : "Vehicle"} <span className="text-red-500">*</span>
              </label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="input-field w-full" required>
                <option value="">{ar ? "اختر السيارة..." : "Select vehicle..."}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} — {ar ? v.nameAr : (v.nameEn ?? v.nameAr)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "الموقع" : "Location"} <span className="text-red-500">*</span>
              </label>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="input-field w-full" required>
                <option value="">{ar ? "اختر الموقع..." : "Select location..."}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {ar ? l.nameAr : (l.nameEn ?? l.nameAr)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {ar ? "التاريخ" : "Date"} <span className="text-red-500">*</span>
              </label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field w-full" required />
            </div>
          </div>

          {/* Revenues */}
          <div className="section-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{ar ? "الإيرادات" : "Revenues"}</h3>
              <button type="button" onClick={addRevenue} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                <Plus size={13} />
                {ar ? "إضافة سطر" : "Add row"}
              </button>
            </div>

            {revenues.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {ar ? "لا توجد إيرادات — اضغط إضافة سطر" : "No revenues — click Add row"}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <span className="col-span-3">{ar ? "النوع" : "Type"}</span>
                  <span className="col-span-4">{ar ? "المبلغ (د.ك)" : "Amount (KWD)"}</span>
                  <span className="col-span-4">{ar ? "البيان" : "Description"}</span>
                  <span className="col-span-1" />
                </div>
                {revenues.map((rev) => (
                  <div key={rev.id} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      value={rev.type}
                      onChange={(e) => setRevField(rev.id, "type", e.target.value as "CASH" | "KNET")}
                      className="input-field col-span-3 text-sm"
                    >
                      <option value="CASH">{ar ? "نقدي" : "Cash"}</option>
                      <option value="KNET">KNET</option>
                    </select>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={rev.amount}
                      onChange={(e) => setRevField(rev.id, "amount", e.target.value)}
                      className="input-field col-span-4 text-sm"
                      dir="ltr"
                    />
                    <input
                      placeholder={ar ? "بيان اختياري" : "Optional note"}
                      value={rev.description}
                      onChange={(e) => setRevField(rev.id, "description", e.target.value)}
                      className="input-field col-span-4 text-sm"
                    />
                    <button type="button" onClick={() => removeRevenue(rev.id)} className="col-span-1 flex justify-center rounded-md p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-6 border-t pt-3 text-sm">
              <span className="text-muted-foreground">{ar ? "نقدي:" : "Cash:"} <span className="number font-bold text-blue-600">{totalCash.toFixed(3)}</span></span>
              <span className="text-muted-foreground">KNET: <span className="number font-bold text-purple-600">{totalKnet.toFixed(3)}</span></span>
            </div>
          </div>

          {/* Expenses */}
          <div className="section-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{ar ? "المصروفات" : "Expenses"}</h3>
              <button type="button" onClick={addExpense} className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-muted">
                <Plus size={13} />
                {ar ? "إضافة سطر" : "Add row"}
              </button>
            </div>

            {expenses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">
                {ar ? "لا توجد مصروفات" : "No expenses"}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium px-1">
                  <span className="col-span-5">{ar ? "البيان" : "Description"}</span>
                  <span className="col-span-6">{ar ? "المبلغ (د.ك)" : "Amount (KWD)"}</span>
                  <span className="col-span-1" />
                </div>
                {expenses.map((exp) => (
                  <div key={exp.id} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      required
                      placeholder={ar ? "وصف المصروف" : "Expense description"}
                      value={exp.description}
                      onChange={(e) => setExpField(exp.id, "description", e.target.value)}
                      className="input-field col-span-5 text-sm"
                    />
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="0.000"
                      value={exp.amount}
                      onChange={(e) => setExpField(exp.id, "amount", e.target.value)}
                      className="input-field col-span-6 text-sm"
                      dir="ltr"
                    />
                    <button type="button" onClick={() => removeExpense(exp.id)} className="col-span-1 flex justify-center rounded-md p-1 text-destructive hover:bg-destructive/10">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "إجمالي نقدي" : "Total cash"}</p>
                <p className="number font-bold text-blue-600">{totalCash.toFixed(3)} {ar ? "د.ك" : "KWD"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">KNET</p>
                <p className="number font-bold text-purple-600">{totalKnet.toFixed(3)} {ar ? "د.ك" : "KWD"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "مصروفات" : "Expenses"}</p>
                <p className="number font-bold text-red-600">{totalExp.toFixed(3)} {ar ? "د.ك" : "KWD"}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{ar ? "صافي الإيراد" : "Net revenue"}</p>
                <p className={`number font-bold text-lg ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {net.toFixed(3)} {ar ? "د.ك" : "KWD"}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">{ar ? "ملاحظات" : "Notes"}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field w-full resize-none" />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? (ar ? "جاري الحفظ..." : "Saving...") : ar ? "حفظ العملية" : "Save operation"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/car-wash/operations`}
              className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
