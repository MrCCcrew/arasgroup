"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, Save, Loader2 } from "lucide-react";

interface DriverData {
  id: string;
  talabatId: string | null;
  roPopsId: string | null;
  isRegisteredTalabat: boolean;
  isRegisteredRoPops: boolean;
  targetOrders: number;
  fuelCardNumber: string | null;
  assignedVehicleId: string | null;
  assignedVehicle: {
    id: string;
    plateNumber: string;
    make: string | null;
    model: string | null;
  } | null;
  vehicleAssignments: { assignedFrom: string }[];
  employee: {
    nameAr: string;
    nameEn: string | null;
    type: string;
    phone: string | null;
    nationality: string | null;
    civilId: string | null;
    passportNumber: string | null;
    passportExpiryDate: string | null;
    dateOfBirth: string | null;
    baseSalary: string | null;
    actualSalary: string | null;
    residencyNumber: string | null;
    residencyExpiry: string | null;
    healthCardExpiryDate: string | null;
    licenseNumber: string | null;
    licenseExpiry: string | null;
    residentialAddress: string | null;
  };
}

type VehicleOption = {
  id: string;
  plateNumber: string;
  make: string | null;
  model: string | null;
  company: { id: string; nameAr: string };
};

export default function EditDriverPage() {
  const router = useRouter();
  const params = useParams<{ companyId: string; driverId: string }>();
  const { companyId, driverId } = params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [civilId, setCivilId] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiryDate, setPassportExpiryDate] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [actualSalary, setActualSalary] = useState("");
  const [residencyNumber, setResidencyNumber] = useState("");
  const [residencyExpiry, setResidencyExpiry] = useState("");
  const [healthCardExpiryDate, setHealthCardExpiryDate] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [talabatId, setTalabatId] = useState("");
  const [roPopsId, setRoPopsId] = useState("");
  const [isRegisteredTalabat, setIsRegisteredTalabat] = useState(false);
  const [isRegisteredRoPops, setIsRegisteredRoPops] = useState(false);
  const [targetOrders, setTargetOrders] = useState("370");
  const [isOfficeStaff, setIsOfficeStaff] = useState(false);
  const [fuelCardNumber, setFuelCardNumber] = useState("");
  const [assignedVehicleId, setAssignedVehicleId] = useState("");
  const [originalVehicleId, setOriginalVehicleId] = useState("");
  const [assignedAt, setAssignedAt] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/drivers/${driverId}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
        const d: DriverData = json.data;

        setNameAr(d.employee.nameAr ?? "");
        setNameEn(d.employee.nameEn ?? "");
        setPhone(d.employee.phone ?? "");
        setNationality(d.employee.nationality ?? "");
        setCivilId(d.employee.civilId ?? "");
        setPassportNumber(d.employee.passportNumber ?? "");
        setPassportExpiryDate(d.employee.passportExpiryDate ? d.employee.passportExpiryDate.slice(0, 10) : "");
        setBaseSalary(d.employee.baseSalary ?? "");
        setActualSalary(d.employee.actualSalary ?? "");
        setResidencyNumber(d.employee.residencyNumber ?? "");
        setResidencyExpiry(d.employee.residencyExpiry ? d.employee.residencyExpiry.slice(0, 10) : "");
        setHealthCardExpiryDate(d.employee.healthCardExpiryDate ? d.employee.healthCardExpiryDate.slice(0, 10) : "");
        setLicenseNumber(d.employee.licenseNumber ?? "");
        setLicenseExpiry(d.employee.licenseExpiry ? d.employee.licenseExpiry.slice(0, 10) : "");
        setResidentialAddress(d.employee.residentialAddress ?? "");
        setDateOfBirth(d.employee.dateOfBirth ? d.employee.dateOfBirth.slice(0, 10) : "");
        setTalabatId(d.talabatId ?? "");
        setRoPopsId(d.roPopsId ?? "");
        setIsRegisteredTalabat(d.isRegisteredTalabat);
        setIsRegisteredRoPops(d.isRegisteredRoPops);
        setTargetOrders(String(d.targetOrders ?? 370));
        setIsOfficeStaff(!["DRIVER", "DELIVERY_DRIVER"].includes(d.employee.type));
        setFuelCardNumber(d.fuelCardNumber ?? "");
        setAssignedVehicleId(d.assignedVehicleId ?? "");
        setOriginalVehicleId(d.assignedVehicleId ?? "");
        if (d.vehicleAssignments[0]?.assignedFrom) {
          const dt = new Date(d.vehicleAssignments[0].assignedFrom);
          dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
          setAssignedAt(dt.toISOString().slice(0, 16));
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "فشل في تحميل بيانات السائق");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [driverId]);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch(`/api/vehicles?companyId=${companyId}&groupWide=true&activeOnly=true&availableForDriverId=${driverId}`);
        const json = await res.json();
        if (json.success) setVehicles(json.data);
      } finally {
        setVehiclesLoading(false);
      }
    }

    loadVehicles();
  }, [companyId, driverId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const vehicleChanged = assignedVehicleId !== originalVehicleId;

    const body: Record<string, unknown> = {
      nameAr,
      nameEn: nameEn || null,
      phone: phone || null,
      nationality: nationality || null,
      civilId: civilId || null,
      passportNumber: passportNumber || null,
      passportExpiryDate: passportExpiryDate || null,
      dateOfBirth: dateOfBirth || null,
      baseSalary: baseSalary ? Number(baseSalary) : null,
      actualSalary: actualSalary ? Number(actualSalary) : null,
      residencyNumber: residencyNumber || null,
      residencyExpiry: residencyExpiry || null,
      healthCardExpiryDate: healthCardExpiryDate || null,
      licenseNumber: licenseNumber || null,
      licenseExpiry: licenseExpiry || null,
      residentialAddress: residentialAddress || null,
      talabatId: talabatId || null,
      roPopsId: roPopsId || null,
      isRegisteredTalabat,
      isRegisteredRoPops,
      targetOrders: targetOrders ? Number(targetOrders) : undefined,
      employeeType: isOfficeStaff ? "DELIVERY_ADMIN" : "DELIVERY_DRIVER",
      fuelCardNumber: fuelCardNumber || null,
      assignedVehicleId: assignedVehicleId || null,
      ...(vehicleChanged && assignedVehicleId ? { assignedAt: assignedAt || null } : {}),
    };

    try {
      const res = await fetch(`/api/delivery/drivers/${driverId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push(`/dashboard/companies/${companyId}/delivery/drivers/${driverId}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "فشل في الحفظ");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">جار تحميل البيانات...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="page-container max-w-lg">
        <div className="mt-12 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-base font-medium text-red-600">{fetchError}</p>
          <Link
            href={`/dashboard/companies/${companyId}/delivery/drivers`}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-muted"
          >
            العودة للسائقين
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b bg-card px-6 py-4">
        <h1 className="text-lg font-bold">تعديل بيانات السائق</h1>
        <p className="text-sm text-muted-foreground">{nameAr}</p>
      </div>

      <div className="page-container space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight size={14} />
          العودة لملف السائق
        </Link>

        <form onSubmit={handleSubmit} className="space-y-6">
          {saveError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
          )}

          <div className="section-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">البيانات الشخصية</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">الاسم بالعربي <span className="text-red-500">*</span></label>
                <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} required className="input-field w-full" dir="rtl" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">الاسم بالإنجليزي</label>
                <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">رقم الجوال</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">الجنسية</label>
                <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">رقم البطاقة المدنية</label>
                <input type="text" value={civilId} onChange={(e) => setCivilId(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">الراتب الأساسي (د.ك)</label>
                <input type="number" step="0.001" min="0" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} className="input-field w-full" dir="ltr" />
                <p className="mt-1 text-xs text-muted-foreground">يُستخدم لحساب بدل الإجازة السنوية ومكافأة نهاية الخدمة</p>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">الراتب الفعلي (د.ك)</label>
                <input type="number" step="0.001" min="0" value={actualSalary} onChange={(e) => setActualSalary(e.target.value)} className="input-field w-full" dir="ltr" />
                <p className="mt-1 text-xs text-muted-foreground">يُستخدم لحساب دفعة الرواتب الشهرية (إن لم يُحدد، يُستخدم الراتب الأساسي)</p>
              </div>
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium">تارجيت الطلبات</label>
                <input type="number" step="1" min="0" value={targetOrders} onChange={(e) => setTargetOrders(e.target.value)} className="input-field w-full" dir="ltr" placeholder="370" disabled={isOfficeStaff} />
                <p className="mt-1 text-xs text-muted-foreground">يُستخدم لحساب الحافز/الخصم تلقائياً في الرواتب.</p>
              </div>
              <label className="col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30">
                <input
                  type="checkbox"
                  checked={isOfficeStaff}
                  onChange={(e) => setIsOfficeStaff(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">يعمل في الإدارة (موظف مكتب)</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    مسجّل كسائق لكنه يعمل إدارياً — يظهر في الرواتب ضمن «الموظفين الآخرين» بدون حساب تارجيت التوصيل.
                  </p>
                </div>
              </label>
              <div>
                <label className="mb-1.5 block text-sm font-medium">تاريخ الميلاد</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">عنوان الإقامة</label>
                <input type="text" value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} className="input-field w-full" />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">جواز السفر</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">رقم جواز السفر</label>
                <input type="text" value={passportNumber} onChange={(e) => setPassportNumber(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">تاريخ انتهاء الجواز</label>
                <input type="date" value={passportExpiryDate} onChange={(e) => setPassportExpiryDate(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">الإقامة والرخصة والصحة</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">رقم الإقامة</label>
                <input type="text" value={residencyNumber} onChange={(e) => setResidencyNumber(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">تاريخ انتهاء الإقامة</label>
                <input type="date" value={residencyExpiry} onChange={(e) => setResidencyExpiry(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">رقم الرخصة</label>
                <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">تاريخ انتهاء الرخصة</label>
                <input type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">تاريخ انتهاء كارت الصحة</label>
                <input type="date" value={healthCardExpiryDate} onChange={(e) => setHealthCardExpiryDate(e.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            </div>
          </div>

          <div className="section-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">تعيين المركبة</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">المركبة الحالية</label>
              <select value={assignedVehicleId} onChange={(e) => setAssignedVehicleId(e.target.value)} className="input-field w-full" disabled={vehiclesLoading}>
                <option value="">بدون مركبة حاليا</option>
                {(() => {
                  const grouped = vehicles.reduce<Record<string, { nameAr: string; items: VehicleOption[] }>>((acc, v) => {
                    const cid = v.company.id;
                    if (!acc[cid]) acc[cid] = { nameAr: v.company.nameAr, items: [] };
                    acc[cid].items.push(v);
                    return acc;
                  }, {});
                  return Object.values(grouped).map((group) => (
                    <optgroup key={group.nameAr} label={group.nameAr}>
                      {group.items.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber}
                          {vehicle.make || vehicle.model ? ` - ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                تغيير المركبة هنا يحدث التعيين الحالي ويحفظه في سجل التعيينات. يمكن اختيار مركبة من أي شركة.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {assignedVehicleId !== originalVehicleId && assignedVehicleId
                  ? "تاريخ ووقت استلام السيارة الجديدة"
                  : "تاريخ ووقت استلام السيارة الحالية"}
              </label>
              <input
                type="datetime-local"
                value={assignedAt}
                onChange={(e) => setAssignedAt(e.target.value)}
                className="input-field w-full"
                dir="ltr"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {assignedVehicleId !== originalVehicleId && assignedVehicleId
                  ? "وقت استلام السيارة الجديدة — مهم لتحديد مسؤولية المخالفات."
                  : "وقت استلام السيارة الحالية — معلومة فقط، لا يتم تحديثه إلا عند تغيير السيارة."}
              </p>
            </div>
          </div>

          <div className="section-card space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">بيانات المنصات</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isRegisteredTalabat} onChange={(e) => setIsRegisteredTalabat(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  <span className="font-medium">مسجل في طلبات</span>
                </label>
                {isRegisteredTalabat && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">معرف طلبات</label>
                    <input type="text" value={talabatId} onChange={(e) => setTalabatId(e.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={isRegisteredRoPops} onChange={(e) => setIsRegisteredRoPops(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  <span className="font-medium">مسجل في Ro Pops</span>
                </label>
                {isRegisteredRoPops && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">معرف Ro Pops</label>
                    <input type="text" value={roPopsId} onChange={(e) => setRoPopsId(e.target.value)} className="input-field w-full" dir="ltr" />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">رقم بطاقة الوقود</label>
              <input type="text" value={fuelCardNumber} onChange={(e) => setFuelCardNumber(e.target.value)} className="input-field w-full" dir="ltr" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Link href={`/dashboard/companies/${companyId}/delivery/drivers/${driverId}`} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
              إلغاء
            </Link>
            <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? "جار الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
