"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Location {
  id: string;
  nameAr: string;
  nameEn: string | null;
  address: string | null;
  locationType: string | null;
  isActive: boolean;
  _count: { operations: number };
}

type FormState = {
  nameAr: string;
  nameEn: string;
  address: string;
  locationType: string;
};

const EMPTY_FORM: FormState = { nameAr: "", nameEn: "", address: "", locationType: "" };

export default function CarWashLocationsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const ar = locale !== "en";

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const res = await fetch(
      `/api/car-wash/locations?companyId=${companyId}&activeOnly=false&month=${month}&year=${year}`
    );
    const json = await res.json();
    if (json.success) setLocations(json.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModal("add");
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({
      nameAr: loc.nameAr,
      nameEn: loc.nameEn ?? "",
      address: loc.address ?? "",
      locationType: loc.locationType ?? "",
    });
    setModal("edit");
  }

  async function save() {
    if (!form.nameAr.trim()) { window.alert(ar ? "الاسم العربي مطلوب" : "Arabic name is required"); return; }
    setSaving(true);

    if (modal === "add") {
      const res = await fetch("/api/car-wash/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...form }),
      });
      const json = await res.json();
      if (!json.success) { window.alert(json.error); setSaving(false); return; }
    } else if (modal === "edit" && editing) {
      const res = await fetch("/api/car-wash/locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing.id, ...form }),
      });
      const json = await res.json();
      if (!json.success) { window.alert(json.error); setSaving(false); return; }
    }

    setSaving(false);
    setModal(null);
    load();
  }

  async function toggleActive(loc: Location) {
    await fetch("/api/car-wash/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: loc.id, isActive: !loc.isActive }),
    });
    load();
  }

  async function remove(loc: Location) {
    const msg = ar
      ? `حذف "${loc.nameAr}"؟ ${loc._count.operations > 0 ? "(سيُعطَّل لأنه يحتوي على عمليات)" : ""}`
      : `Delete "${loc.nameEn ?? loc.nameAr}"? ${loc._count.operations > 0 ? "(will be deactivated — has operations)" : ""}`;
    if (!window.confirm(msg)) return;
    await fetch(`/api/car-wash/locations?id=${loc.id}`, { method: "DELETE" });
    load();
  }

  const f = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  const visible = locations.filter((l) => showInactive || l.isActive);
  const activeCount = locations.filter((l) => l.isActive).length;

  return (
    <div>
      <Header
        title={ar ? "مواقع غسيل السيارات" : "Car Wash Locations"}
        subtitle={ar ? "إدارة المواقع المتاحة للعمليات اليومية" : "Manage locations for daily operations"}
        companyId={companyId}
        actions={
          <button
            onClick={openAdd}
            className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
          >
            <Plus size={15} />
            {ar ? "موقع جديد" : "New location"}
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{ar ? "إجمالي المواقع" : "Total locations"}</p>
            <p className="text-2xl font-bold">{locations.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{ar ? "نشطة" : "Active"}</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{ar ? "غير نشطة" : "Inactive"}</p>
            <p className="text-2xl font-bold text-muted-foreground">{locations.length - activeCount}</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            {ar ? "عرض غير النشطة" : "Show inactive"}
          </label>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {ar ? "جاري التحميل..." : "Loading..."}
            </p>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <MapPin size={40} className="opacity-30" />
              <p className="text-sm">{ar ? "لا توجد مواقع مضافة بعد" : "No locations added yet"}</p>
              <button
                onClick={openAdd}
                className="mt-1 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <Plus size={14} />
                {ar ? "أضف أول موقع" : "Add first location"}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{ar ? "الاسم (عربي)" : "Name (Arabic)"}</th>
                    <th>{ar ? "الاسم (إنجليزي)" : "Name (English)"}</th>
                    <th>{ar ? "العنوان" : "Address"}</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th>{ar ? "العمليات" : "Operations"}</th>
                    <th>{ar ? "الحالة" : "Status"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((loc) => (
                    <tr key={loc.id} className={`transition-colors hover:bg-muted/20 ${!loc.isActive ? "opacity-50" : ""}`}>
                      <td className="font-medium">{loc.nameAr}</td>
                      <td className="text-muted-foreground">{loc.nameEn ?? "—"}</td>
                      <td className="text-sm text-muted-foreground">{loc.address ?? "—"}</td>
                      <td className="text-sm">{loc.locationType ?? "—"}</td>
                      <td>
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">
                          {loc._count.operations}
                        </span>
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          loc.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>
                          {loc.isActive ? (ar ? "نشط" : "Active") : (ar ? "معطّل" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openEdit(loc)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={ar ? "تعديل" : "Edit"}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleActive(loc)}
                            className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                            title={loc.isActive ? (ar ? "تعطيل" : "Deactivate") : (ar ? "تفعيل" : "Activate")}
                          >
                            {loc.isActive ? (ar ? "تعطيل" : "Deactivate") : (ar ? "تفعيل" : "Activate")}
                          </button>
                          {loc._count.operations === 0 && (
                            <button
                              onClick={() => remove(loc)}
                              className="rounded-md p-1.5 text-destructive hover:bg-destructive/10"
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-semibold">
                {modal === "add"
                  ? (ar ? "موقع جديد" : "New location")
                  : (ar ? "تعديل الموقع" : "Edit location")}
              </h2>
              <button onClick={() => setModal(null)} className="rounded-lg p-1.5 hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="form-label">
                  {ar ? "الاسم (عربي)" : "Name (Arabic)"}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  value={form.nameAr}
                  onChange={f("nameAr")}
                  className="input-field"
                  placeholder={ar ? "مثال: فرع السالمية" : "e.g. Salmiya Branch"}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label">{ar ? "الاسم (إنجليزي)" : "Name (English)"}</label>
                <input
                  value={form.nameEn}
                  onChange={f("nameEn")}
                  className="input-field"
                  placeholder="e.g. Salmiya Branch"
                />
              </div>
              <div>
                <label className="form-label">{ar ? "العنوان" : "Address"}</label>
                <input
                  value={form.address}
                  onChange={f("address")}
                  className="input-field"
                  placeholder={ar ? "مثال: شارع 14، السالمية" : "e.g. Street 14, Salmiya"}
                />
              </div>
              <div>
                <label className="form-label">{ar ? "نوع الموقع" : "Location type"}</label>
                <input
                  value={form.locationType}
                  onChange={f("locationType")}
                  className="input-field"
                  placeholder={ar ? "مثال: موقف، شارع، مجمع..." : "e.g. Parking, Street, Mall..."}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setModal(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving
                    ? (ar ? "جاري الحفظ..." : "Saving...")
                    : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
