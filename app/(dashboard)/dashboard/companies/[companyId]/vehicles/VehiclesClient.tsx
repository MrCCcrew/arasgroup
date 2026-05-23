"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, PowerOff, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { VehicleRow } from "./page";

interface Branch {
  id: string;
  nameAr: string;
  nameEn: string | null;
}

interface Props {
  initialVehicles: VehicleRow[];
  branches: Branch[];
  companyId: string;
  locale: string;
}

function daysLeft(d: Date | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

function formatDate(d: Date | null | undefined, locale: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(locale === "en" ? "en-US" : "ar-KW");
}

function ExpiryBadge({ date }: { date: Date | null | undefined }) {
  if (!date) return <span className="text-muted-foreground text-sm">—</span>;
  const days = daysLeft(date);
  const formatted = formatDate(date, "ar");
  const color =
    days === null ? "text-muted-foreground"
    : days < 0 ? "text-red-600 font-semibold"
    : days <= 30 ? "text-red-500"
    : days <= 90 ? "text-orange-500"
    : "text-foreground";
  return (
    <div className="flex items-center gap-1">
      <span className={`text-sm ${color}`}>{formatted}</span>
      {days !== null && days <= 30 && (
        <AlertTriangle size={12} className={days < 0 ? "text-red-600" : "text-yellow-500"} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4 sticky top-0 bg-card">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const EMPTY_EDIT = {
  plateNumber: "",
  vehicleNumber: "",
  make: "",
  model: "",
  year: "",
  color: "",
  chassisNumber: "",
  ownershipModel: "OWNER_OWNED",
  trackingDeviceId: "",
  fuelCardNumber: "",
  insuranceExpiry: "",
  registrationExpiry: "",
  municipalityCardNumber: "",
  municipalityCardExpiryDate: "",
  advertisingCardNumber: "",
  advertisingCardExpiryDate: "",
  notes: "",
};

export function VehiclesClient({ initialVehicles, branches, companyId, locale }: Props) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<VehicleRow[]>(initialVehicles);
  const [editVehicle, setEditVehicle] = useState<VehicleRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  function openEdit(v: VehicleRow) {
    setEditVehicle(v);
    const eff = (d: Date | null | undefined) => d ? new Date(d).toISOString().slice(0, 10) : "";
    setEditForm({
      plateNumber: v.plateNumber,
      vehicleNumber: v.vehicleNumber ?? "",
      make: v.make ?? "",
      model: v.model ?? "",
      year: v.year?.toString() ?? "",
      color: v.color ?? "",
      chassisNumber: v.chassisNumber ?? "",
      ownershipModel: v.ownershipModel,
      trackingDeviceId: v.trackingDeviceId ?? "",
      fuelCardNumber: v.fuelCardNumber ?? "",
      insuranceExpiry: eff(v.insuranceExpiry ?? v.insuranceExpiryDate),
      registrationExpiry: eff(v.registrationExpiry),
      municipalityCardNumber: v.municipalityCardNumber ?? "",
      municipalityCardExpiryDate: eff(v.municipalityCardExpiryDate),
      advertisingCardNumber: v.advertisingCardNumber ?? "",
      advertisingCardExpiryDate: eff(v.advertisingCardExpiryDate),
      notes: v.notes ?? "",
    });
    setEditError("");
  }

  function ef(key: keyof typeof EMPTY_EDIT) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function saveEdit() {
    if (!editVehicle) return;
    setSaving(true); setEditError("");
    try {
      const res = await fetch(`/api/vehicles/${editVehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: editForm.plateNumber || undefined,
          vehicleNumber: editForm.vehicleNumber || null,
          make: editForm.make || null,
          model: editForm.model || null,
          year: editForm.year ? parseInt(editForm.year, 10) : null,
          color: editForm.color || null,
          chassisNumber: editForm.chassisNumber || null,
          ownershipModel: editForm.ownershipModel,
          trackingDeviceId: editForm.trackingDeviceId || null,
          fuelCardNumber: editForm.fuelCardNumber || null,
          insuranceExpiry: editForm.insuranceExpiry || null,
          registrationExpiry: editForm.registrationExpiry || null,
          municipalityCardNumber: editForm.municipalityCardNumber || null,
          municipalityCardExpiryDate: editForm.municipalityCardExpiryDate || null,
          advertisingCardNumber: editForm.advertisingCardNumber || null,
          advertisingCardExpiryDate: editForm.advertisingCardExpiryDate || null,
          notes: editForm.notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "حدث خطأ");
      setEditVehicle(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateId) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/vehicles/${deactivateId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDeactivateId(null);
      router.refresh();
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="page-container">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="ar-table">
            <thead>
              <tr>
                <th>{locale === "en" ? "Plate" : "اللوحة"}</th>
                <th>{locale === "en" ? "Vehicle No." : "رقم المركبة"}</th>
                <th>{locale === "en" ? "Make / Model" : "الماركة / الموديل"}</th>
                <th>{locale === "en" ? "Ownership" : "الملكية"}</th>
                <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                <th>{locale === "en" ? "Driver" : "السائق"}</th>
                <th>{locale === "en" ? "Insurance" : "التأمين"}</th>
                <th>{locale === "en" ? "Registration" : "التسجيل"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-muted-foreground">
                    {locale === "en" ? "No vehicles found" : "لا توجد مركبات"}
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const insuranceDate = v.insuranceExpiry ?? v.insuranceExpiryDate;
                  const days = daysLeft(insuranceDate);
                  const expiringSoon = days !== null && days <= 30;
                  const branchName = v.branch
                    ? locale === "en" ? v.branch.nameEn ?? v.branch.nameAr : v.branch.nameAr
                    : "—";
                  const driverName = v.assignedEmployee
                    ? locale === "en" ? v.assignedEmployee.nameEn ?? v.assignedEmployee.nameAr : v.assignedEmployee.nameAr
                    : "—";

                  return (
                    <tr key={v.id} className={`hover:bg-muted/20 transition-colors ${expiringSoon ? "bg-yellow-50/30" : ""}`}>
                      <td className="number font-medium">{v.plateNumber}</td>
                      <td className="number text-sm">{v.vehicleNumber ?? "—"}</td>
                      <td className="text-sm">
                        {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${v.ownershipModel === "RENTED" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {v.ownershipModel === "RENTED" ? (locale === "en" ? "Rented" : "مؤجرة") : (locale === "en" ? "Owned" : "مملوكة")}
                        </span>
                      </td>
                      <td className="text-sm">{branchName}</td>
                      <td className="text-sm">{driverName}</td>
                      <td><ExpiryBadge date={insuranceDate} /></td>
                      <td><ExpiryBadge date={v.registrationExpiry} /></td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(v)}
                            className="rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="تعديل"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeactivateId(v.id)}
                            className="rounded p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="إيقاف"
                          >
                            <PowerOff size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editVehicle && (
        <Modal title={`تعديل: ${editVehicle.plateNumber}`} onClose={() => setEditVehicle(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">رقم اللوحة *</label>
                <input className="input-field w-full" dir="ltr" value={editForm.plateNumber} onChange={ef("plateNumber")} />
              </div>
              <div>
                <label className="form-label">رقم المركبة</label>
                <input className="input-field w-full" dir="ltr" value={editForm.vehicleNumber} onChange={ef("vehicleNumber")} />
              </div>
              <div>
                <label className="form-label">الماركة</label>
                <input className="input-field w-full" value={editForm.make} onChange={ef("make")} />
              </div>
              <div>
                <label className="form-label">الموديل</label>
                <input className="input-field w-full" value={editForm.model} onChange={ef("model")} />
              </div>
              <div>
                <label className="form-label">سنة الصنع</label>
                <input type="number" className="input-field w-full" dir="ltr" value={editForm.year} onChange={ef("year")} />
              </div>
              <div>
                <label className="form-label">اللون</label>
                <input className="input-field w-full" value={editForm.color} onChange={ef("color")} />
              </div>
              <div>
                <label className="form-label">الملكية</label>
                <select className="input-field w-full" value={editForm.ownershipModel} onChange={ef("ownershipModel")}>
                  <option value="OWNER_OWNED">مملوكة</option>
                  <option value="RENTED">مؤجرة</option>
                </select>
              </div>
              <div>
                <label className="form-label">رقم بطاقة الوقود</label>
                <input className="input-field w-full" dir="ltr" value={editForm.fuelCardNumber} onChange={ef("fuelCardNumber")} />
              </div>
              <div>
                <label className="form-label">انتهاء التأمين</label>
                <input type="date" className="input-field w-full" value={editForm.insuranceExpiry} onChange={ef("insuranceExpiry")} />
              </div>
              <div>
                <label className="form-label">انتهاء التسجيل</label>
                <input type="date" className="input-field w-full" value={editForm.registrationExpiry} onChange={ef("registrationExpiry")} />
              </div>
              <div>
                <label className="form-label">انتهاء بطاقة البلدية</label>
                <input type="date" className="input-field w-full" value={editForm.municipalityCardExpiryDate} onChange={ef("municipalityCardExpiryDate")} />
              </div>
              <div>
                <label className="form-label">انتهاء بطاقة الدعاية</label>
                <input type="date" className="input-field w-full" value={editForm.advertisingCardExpiryDate} onChange={ef("advertisingCardExpiryDate")} />
              </div>
            </div>
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field w-full resize-none" rows={2} value={editForm.notes} onChange={ef("notes")} />
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
