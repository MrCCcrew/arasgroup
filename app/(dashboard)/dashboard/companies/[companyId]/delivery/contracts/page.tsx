"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, FileText } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Contract {
  id: string;
  nameAr: string;
  nameEn: string | null;
  platform: "TALABAT" | "RO_POPS";
  startDate: string;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
}

const PLATFORM_LABELS: Record<string, string> = {
  TALABAT: "طلبات",
  RO_POPS: "روبوبس",
};

const PLATFORM_COLORS: Record<string, string> = {
  TALABAT: "bg-orange-100 text-orange-700",
  RO_POPS: "bg-blue-100 text-blue-700",
};

const now = new Date();
const EMPTY = {
  nameAr: "",
  nameEn: "",
  platform: "TALABAT" as "TALABAT" | "RO_POPS",
  startDate: now.toISOString().slice(0, 10),
  endDate: "",
  notes: "",
};

type Form = typeof EMPTY;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function ContractsPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/delivery/contracts?companyId=${companyId}`).then((r) => r.json());
    if (res.success) setContracts(res.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function f<K extends keyof Form>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(c: Contract) {
    setEditId(c.id);
    setForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn ?? "",
      platform: c.platform,
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate?.slice(0, 10) ?? "",
      notes: c.notes ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.nameAr.trim()) { setFormError("اسم العقد مطلوب"); return; }
    setSaving(true); setFormError("");
    const body = {
      ...form,
      nameEn: form.nameEn || null,
      endDate: form.endDate || null,
      notes: form.notes || null,
      ...(!editId ? { companyId } : {}),
    };
    const res = await fetch(
      editId ? `/api/delivery/contracts/${editId}` : "/api/delivery/contracts",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? "حدث خطأ"); return; }
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/delivery/contracts/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    setDeleteId(null);
    load();
  }

  const activeCount = contracts.filter((c) => c.isActive).length;
  const talabatCount = contracts.filter((c) => c.platform === "TALABAT").length;
  const popsCount = contracts.filter((c) => c.platform === "RO_POPS").length;

  return (
    <div>
      <Header
        title="العقود والمنصات"
        subtitle="عقود التوصيل مع المنصات"
        companyId={companyId}
        actions={
          <button onClick={openAdd} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            + إضافة عقد
          </button>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">عقود نشطة</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">طلبات</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{talabatCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">روبوبس</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{popsCount}</p>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={40} className="mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">لا توجد عقود — اضغط "إضافة عقد" للبدء</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>اسم العقد</th>
                    <th>المنصة</th>
                    <th>تاريخ البداية</th>
                    <th>تاريخ النهاية</th>
                    <th>الحالة</th>
                    <th>ملاحظات</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="font-medium">{c.nameAr}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PLATFORM_COLORS[c.platform]}`}>
                          {PLATFORM_LABELS[c.platform]}
                        </span>
                      </td>
                      <td className="text-sm">{new Date(c.startDate).toLocaleDateString("ar-KW")}</td>
                      <td className="text-sm">
                        {c.endDate
                          ? new Date(c.endDate).toLocaleDateString("ar-KW")
                          : <span className="text-muted-foreground">مفتوح</span>}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.isActive ? "نشط" : "متوقف"}
                        </span>
                      </td>
                      <td className="max-w-xs truncate text-sm text-muted-foreground">
                        {c.notes ?? "—"}
                      </td>
                      <td className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => { setDeleteId(c.id); setDeleteError(""); }}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <Modal title={editId ? "تعديل العقد" : "إضافة عقد جديد"} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">اسم العقد (عربي) *</label>
              <input className="input-field" value={form.nameAr} onChange={f("nameAr")} />
            </div>
            <div>
              <label className="form-label">اسم العقد (إنجليزي)</label>
              <input className="input-field" dir="ltr" value={form.nameEn} onChange={f("nameEn")} />
            </div>
            <div>
              <label className="form-label">المنصة *</label>
              <select className="input-field" value={form.platform} onChange={f("platform")}>
                <option value="TALABAT">طلبات</option>
                <option value="RO_POPS">روبوبس</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">تاريخ البداية *</label>
                <input type="date" className="input-field" value={form.startDate} onChange={f("startDate")} />
              </div>
              <div>
                <label className="form-label">تاريخ النهاية</label>
                <input type="date" className="input-field" value={form.endDate} onChange={f("endDate")} />
              </div>
            </div>
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={f("notes")} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : editId ? "حفظ التعديلات" : "إضافة"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal title="تأكيد الحذف" onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">هل أنت متأكد من إيقاف هذا العقد؟</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button onClick={confirmDelete} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? "جاري الحذف..." : "إيقاف"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
