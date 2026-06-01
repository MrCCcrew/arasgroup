"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { X, FileText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface Contract {
  id: string;
  nameAr: string;
  nameEn: string | null;
  platform: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
}

const KNOWN_PLATFORMS: Record<string, { ar: string; en: string; color: string }> = {
  TALABAT: { ar: "طلبات", en: "Talabat", color: "bg-orange-100 text-orange-700" },
  RO_POPS: { ar: "روبوبس", en: "RoPops", color: "bg-blue-100 text-blue-700" },
};

function getPlatformLabel(platform: string | null, en: boolean): string {
  if (!platform) return en ? "No platform" : "بدون منصة";
  const p = KNOWN_PLATFORMS[platform];
  return p ? (en ? p.en : p.ar) : platform;
}

function getPlatformColor(platform: string | null): string {
  if (!platform) return "bg-gray-100 text-gray-500";
  return KNOWN_PLATFORMS[platform]?.color ?? "bg-purple-100 text-purple-700";
}

const PREDEFINED = ["TALABAT", "RO_POPS"];

const now = new Date();
const EMPTY = {
  nameAr: "",
  nameEn: "",
  platformSelect: "",
  platformCustom: "",
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
  const { locale } = useLocale();
  const en = locale === "en";
  const numberLocale = en ? "en-US" : "ar-KW";
  const t = {
    title: en ? "Contracts & Platforms" : "العقود والمنصات",
    subtitle: en ? "Delivery contracts with platforms" : "عقود التوصيل مع المنصات",
    addContract: en ? "Add contract" : "إضافة عقد",
    totalContracts: en ? "Total contracts" : "إجمالي العقود",
    activeContracts: en ? "Active contracts" : "عقود نشطة",
    loading: en ? "Loading..." : "جاري التحميل...",
    empty: en ? "No contracts — click \"Add contract\" to start" : "لا توجد عقود — اضغط \"إضافة عقد\" للبدء",
    contractName: en ? "Contract name" : "اسم العقد",
    platform: en ? "Platform" : "المنصة",
    startDate: en ? "Start date" : "تاريخ البداية",
    endDate: en ? "End date" : "تاريخ النهاية",
    status: en ? "Status" : "الحالة",
    notes: en ? "Notes" : "ملاحظات",
    open: en ? "Open" : "مفتوح",
    active: en ? "Active" : "نشط",
    stopped: en ? "Stopped" : "متوقف",
    edit: en ? "Edit" : "تعديل",
    delete: en ? "Delete" : "حذف",
    editModal: en ? "Edit contract" : "تعديل العقد",
    addModal: en ? "Add new contract" : "إضافة عقد جديد",
    nameArLabel: en ? "Contract name (Arabic) *" : "اسم العقد (عربي) *",
    nameEnLabel: en ? "Contract name (English)" : "اسم العقد (إنجليزي)",
    noPlatformOpt: en ? "— No platform —" : "— بدون منصة —",
    customOpt: en ? "Other platform (type manually)..." : "منصة أخرى (اكتب يدوياً)...",
    platformNameLabel: en ? "Platform name *" : "اسم المنصة *",
    cancel: en ? "Cancel" : "إلغاء",
    saving: en ? "Saving..." : "جاري الحفظ...",
    saveChanges: en ? "Save changes" : "حفظ التعديلات",
    add: en ? "Add" : "إضافة",
    nameRequired: en ? "Contract name is required" : "اسم العقد مطلوب",
    platformRequired: en ? "Please type the platform name" : "يرجى كتابة اسم المنصة",
    genericError: en ? "An error occurred" : "حدث خطأ",
    deleteFailed: en ? "Delete failed" : "فشل الحذف",
    confirmStop: en ? "Confirm" : "تأكيد الحذف",
    stopWarn: en ? "Are you sure you want to stop this contract?" : "هل أنت متأكد من إيقاف هذا العقد؟",
    deleting: en ? "Deleting..." : "جاري الحذف...",
    stop: en ? "Stop" : "إيقاف",
  };

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

  function resolvePlatform(): string | null {
    if (form.platformSelect === "__custom__") {
      return form.platformCustom.trim() || null;
    }
    return form.platformSelect || null;
  }

  function openAdd() {
    setEditId(null);
    setForm(EMPTY);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(c: Contract) {
    setEditId(c.id);
    const isKnown = c.platform && PREDEFINED.includes(c.platform);
    setForm({
      nameAr: c.nameAr,
      nameEn: c.nameEn ?? "",
      platformSelect: isKnown ? (c.platform ?? "") : (c.platform ? "__custom__" : ""),
      platformCustom: isKnown ? "" : (c.platform ?? ""),
      startDate: c.startDate.slice(0, 10),
      endDate: c.endDate?.slice(0, 10) ?? "",
      notes: c.notes ?? "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function save() {
    if (!form.nameAr.trim()) { setFormError(t.nameRequired); return; }
    if (form.platformSelect === "__custom__" && !form.platformCustom.trim()) {
      setFormError(t.platformRequired); return;
    }
    setSaving(true); setFormError("");
    const body = {
      nameAr: form.nameAr,
      nameEn: form.nameEn || null,
      platform: resolvePlatform(),
      startDate: form.startDate,
      endDate: form.endDate || null,
      notes: form.notes || null,
      ...(!editId ? { companyId } : {}),
    };
    const res = await fetch(
      editId ? `/api/delivery/contracts/${editId}` : "/api/delivery/contracts",
      { method: editId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setFormError(data.error ?? t.genericError); return; }
    setShowForm(false);
    load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/delivery/contracts/${deleteId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? t.deleteFailed); return; }
    setDeleteId(null);
    load();
  }

  const activeCount = contracts.filter((c) => c.isActive).length;

  return (
    <div>
      <Header
        title={t.title}
        subtitle={t.subtitle}
        companyId={companyId}
        actions={
          <button onClick={openAdd} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            + {t.addContract}
          </button>
        }
      />

      <div className="page-container space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.totalContracts}</p>
            <p className="mt-1 text-2xl font-bold">{contracts.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{t.activeContracts}</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeCount}</p>
          </div>
          {Object.entries(KNOWN_PLATFORMS).map(([key, info]) => {
            const count = contracts.filter((c) => c.platform === key).length;
            if (count === 0) return null;
            return (
              <div key={key} className="stat-card">
                <p className="text-xs text-muted-foreground">{en ? info.en : info.ar}</p>
                <p className={`mt-1 text-2xl font-bold ${info.color.split(" ")[1]}`}>{count}</p>
              </div>
            );
          })}
        </div>

        <div className="section-card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{t.loading}</div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={40} className="mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">{t.empty}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>{t.contractName}</th>
                    <th>{t.platform}</th>
                    <th>{t.startDate}</th>
                    <th>{t.endDate}</th>
                    <th>{t.status}</th>
                    <th>{t.notes}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="font-medium">{c.nameAr}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(c.platform)}`}>
                          {getPlatformLabel(c.platform, en)}
                        </span>
                      </td>
                      <td className="text-sm">{new Date(c.startDate).toLocaleDateString(numberLocale)}</td>
                      <td className="text-sm">
                        {c.endDate ? new Date(c.endDate).toLocaleDateString(numberLocale) : <span className="text-muted-foreground">{t.open}</span>}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${c.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.isActive ? t.active : t.stopped}
                        </span>
                      </td>
                      <td className="max-w-xs truncate text-sm text-muted-foreground">{c.notes ?? "—"}</td>
                      <td className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openEdit(c)} className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50">{t.edit}</button>
                        <button onClick={() => { setDeleteId(c.id); setDeleteError(""); }} className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50">{t.delete}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <Modal title={editId ? t.editModal : t.addModal} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">{t.nameArLabel}</label>
              <input className="input-field w-full" value={form.nameAr} onChange={f("nameAr")} />
            </div>
            <div>
              <label className="form-label">{t.nameEnLabel}</label>
              <input className="input-field w-full" dir="ltr" value={form.nameEn} onChange={f("nameEn")} />
            </div>
            <div>
              <label className="form-label">{t.platform}</label>
              <select className="input-field w-full" value={form.platformSelect} onChange={f("platformSelect")}>
                <option value="">{t.noPlatformOpt}</option>
                <option value="TALABAT">{en ? "Talabat" : "طلبات"}</option>
                <option value="RO_POPS">{en ? "RoPops" : "روبوبس"}</option>
                <option value="__custom__">{t.customOpt}</option>
              </select>
            </div>
            {form.platformSelect === "__custom__" && (
              <div>
                <label className="form-label">{t.platformNameLabel}</label>
                <input
                  className="input-field w-full"
                  value={form.platformCustom}
                  onChange={f("platformCustom")}
                  placeholder={en ? "e.g. Deliveroo, Careem Food..." : "مثال: Deliveroo، Careem Food..."}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">{t.startDate} *</label>
                <input type="date" className="input-field w-full" value={form.startDate} onChange={f("startDate")} />
              </div>
              <div>
                <label className="form-label">{t.endDate}</label>
                <input type="date" className="input-field w-full" value={form.endDate} onChange={f("endDate")} />
              </div>
            </div>
            <div>
              <label className="form-label">{t.notes}</label>
              <textarea className="input-field w-full" rows={2} value={form.notes} onChange={f("notes")} />
            </div>
            {formError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? t.saving : editId ? t.saveChanges : t.add}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal title={t.confirmStop} onClose={() => setDeleteId(null)}>
          <p className="text-sm text-muted-foreground">{t.stopWarn}</p>
          {deleteError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">{t.cancel}</button>
            <button onClick={confirmDelete} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deleting ? t.deleting : t.stop}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
