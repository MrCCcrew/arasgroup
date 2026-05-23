"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Car, Users, Plus, Pencil, X, PowerOff } from "lucide-react";
import { Header } from "@/components/layout/header";

interface Worker {
  id: string;
  role: string;
  employee: { nameAr: string };
}

interface Vehicle {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string | null;
  knetDeviceId: string | null;
  isActive: boolean;
  vehicle: {
    plateNumber: string;
    model: string | null;
    make: string | null;
    color: string | null;
    registrationExpiry: string | null;
    insuranceExpiry: string | null;
  };
  workers: Worker[];
  costCenter: { nameAr: string } | null;
}

const WORKER_ROLE_LABELS: Record<string, string> = {
  DRIVER: "سائق",
  WASHER: "غاسل",
};

function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryLine({ label, date }: { label: string; date: string | null | undefined }) {
  if (!date) return null;
  const days = daysLeft(date);
  const formatted = new Date(date).toLocaleDateString("ar-KW");
  const color = days === null ? "" : days < 0 ? "text-red-600" : days <= 30 ? "text-red-500" : days <= 90 ? "text-orange-500" : "text-muted-foreground";
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{formatted}</span>
    </div>
  );
}

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

const EMPTY_EDIT = {
  nameAr: "",
  knetDeviceId: "",
  plateNumber: "",
  model: "",
  make: "",
  color: "",
  registrationExpiry: "",
  insuranceExpiry: "",
  notes: "",
};

export default function CarWashVehiclesPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/car-wash/vehicles?companyId=${companyId}`).then((r) => r.json());
    if (res.success) setVehicles(res.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function openEdit(v: Vehicle) {
    setEditVehicle(v);
    setEditForm({
      nameAr: v.nameAr,
      knetDeviceId: v.knetDeviceId ?? "",
      plateNumber: v.vehicle.plateNumber,
      model: v.vehicle.model ?? "",
      make: v.vehicle.make ?? "",
      color: v.vehicle.color ?? "",
      registrationExpiry: v.vehicle.registrationExpiry?.slice(0, 10) ?? "",
      insuranceExpiry: v.vehicle.insuranceExpiry?.slice(0, 10) ?? "",
      notes: "",
    });
    setEditError("");
  }

  function ef(key: keyof typeof EMPTY_EDIT) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function saveEdit() {
    if (!editVehicle) return;
    if (!editForm.nameAr.trim()) { setEditError("الاسم مطلوب"); return; }
    setSaving(true); setEditError("");
    const res = await fetch(`/api/car-wash/vehicles/${editVehicle.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: editForm.nameAr,
        knetDeviceId: editForm.knetDeviceId || null,
        plateNumber: editForm.plateNumber || undefined,
        model: editForm.model || null,
        make: editForm.make || null,
        color: editForm.color || null,
        registrationExpiry: editForm.registrationExpiry || null,
        insuranceExpiry: editForm.insuranceExpiry || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setEditError(data.error ?? "حدث خطأ"); return; }
    setEditVehicle(null);
    load();
  }

  async function confirmDeactivate() {
    if (!deactivateId) return;
    setDeactivating(true); setDeactivateError("");
    const res = await fetch(`/api/car-wash/vehicles/${deactivateId}`, { method: "DELETE" });
    const data = await res.json();
    setDeactivating(false);
    if (!data.success) { setDeactivateError(data.error ?? "فشل"); return; }
    setDeactivateId(null);
    load();
  }

  const activeCount = vehicles.filter((v) => v.isActive).length;

  return (
    <div>
      <Header
        title="مركبات الغسيل"
        subtitle={`${vehicles.length} مركبة`}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/car-wash/vehicles/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} /> إضافة مركبة
          </Link>
        }
      />

      <div className="page-container space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">إجمالي المركبات</p>
            <p className="mt-1 text-2xl font-bold">{vehicles.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">نشطة</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{activeCount}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">موقوفة</p>
            <p className={`mt-1 text-2xl font-bold ${vehicles.length - activeCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>
              {vehicles.length - activeCount}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">جاري التحميل...</div>
        ) : vehicles.length === 0 ? (
          <div className="section-card flex flex-col items-center justify-center py-16">
            <Car size={48} className="mb-4 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-bold">لا توجد مركبات</h2>
            <p className="text-sm text-muted-foreground">ابدأ بإضافة مركبة غسيل جديدة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((v) => (
              <div key={v.id} className={`section-card space-y-3 ${!v.isActive ? "opacity-60" : ""}`}>
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Car size={18} className="text-primary" />
                      <h3 className="font-bold">{v.nameAr}</h3>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{v.code}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {v.vehicle.plateNumber}{v.vehicle.model ? ` — ${v.vehicle.model}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${v.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {v.isActive ? "نشط" : "متوقف"}
                    </span>
                  </div>
                </div>

                {/* Vehicle details */}
                <div className="space-y-1 text-sm">
                  {v.knetDeviceId && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">جهاز KNET</span>
                      <span className="font-mono text-xs">{v.knetDeviceId}</span>
                    </div>
                  )}
                  {v.costCenter && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">مركز التكلفة</span>
                      <span>{v.costCenter.nameAr}</span>
                    </div>
                  )}
                </div>

                {/* Expiry dates */}
                {(v.vehicle.registrationExpiry || v.vehicle.insuranceExpiry) && (
                  <div className="space-y-1 rounded-lg bg-muted/30 px-3 py-2">
                    <ExpiryLine label="استمارة التسجيل" date={v.vehicle.registrationExpiry} />
                    <ExpiryLine label="التأمين" date={v.vehicle.insuranceExpiry} />
                  </div>
                )}

                {/* Workers */}
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users size={12} />
                    <span>الفريق ({v.workers.length})</span>
                  </div>
                  {v.workers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">لم يتم تعيين فريق</p>
                  ) : (
                    <div className="space-y-1">
                      {v.workers.map((w) => (
                        <div key={w.id} className="flex items-center justify-between text-sm">
                          <span>{w.employee.nameAr}</span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                            {WORKER_ROLE_LABELS[w.role] ?? w.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t pt-3">
                  <button
                    onClick={() => openEdit(v)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs hover:bg-muted"
                  >
                    <Pencil size={12} /> تعديل
                  </button>
                  {v.isActive && (
                    <button
                      onClick={() => { setDeactivateId(v.id); setDeactivateError(""); }}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <PowerOff size={12} /> إيقاف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editVehicle && (
        <Modal title={`تعديل: ${editVehicle.nameAr}`} onClose={() => setEditVehicle(null)}>
          <div className="space-y-3">
            <div>
              <label className="form-label">الاسم *</label>
              <input className="input-field" value={editForm.nameAr} onChange={ef("nameAr")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">رقم اللوحة</label>
                <input className="input-field" dir="ltr" value={editForm.plateNumber} onChange={ef("plateNumber")} />
              </div>
              <div>
                <label className="form-label">جهاز KNET</label>
                <input className="input-field" dir="ltr" value={editForm.knetDeviceId} onChange={ef("knetDeviceId")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">الماركة</label>
                <input className="input-field" value={editForm.make} onChange={ef("make")} />
              </div>
              <div>
                <label className="form-label">الموديل</label>
                <input className="input-field" value={editForm.model} onChange={ef("model")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">انتهاء التسجيل</label>
                <input type="date" className="input-field" value={editForm.registrationExpiry} onChange={ef("registrationExpiry")} />
              </div>
              <div>
                <label className="form-label">انتهاء التأمين</label>
                <input type="date" className="input-field" value={editForm.insuranceExpiry} onChange={ef("insuranceExpiry")} />
              </div>
            </div>
            {editError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditVehicle(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deactivate confirm */}
      {deactivateId && (
        <Modal title="تأكيد الإيقاف" onClose={() => setDeactivateId(null)}>
          <p className="text-sm text-muted-foreground">هل تريد إيقاف هذه المركبة؟ ستبقى البيانات محفوظة.</p>
          {deactivateError && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{deactivateError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeactivateId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button onClick={confirmDeactivate} disabled={deactivating} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {deactivating ? "جاري الإيقاف..." : "إيقاف"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
