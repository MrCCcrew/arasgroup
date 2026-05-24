"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";

interface LicenseOption {
  id: string;
  commercialNameAr: string;
  licenseNumber: string;
}

export default function NewDeliveryVehiclePage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [licenses, setLicenses] = useState<LicenseOption[]>([]);
  const [form, setForm] = useState({
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
    licenseId: "",
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/licenses?companyId=${companyId}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.data)) {
          const EXCLUDED = new Set(["CANCELLED", "INACTIVE"]);
          setLicenses(
            d.data
              .filter((l: { status?: string }) => !EXCLUDED.has(l.status ?? ""))
              .map((l: { id: string; commercialNameAr: string; licenseNumber: string }) => ({
                id: l.id,
                commercialNameAr: l.commercialNameAr,
                licenseNumber: l.licenseNumber,
              }))
          );
        }
      })
      .catch(() => {});
  }, [companyId]);

  function setField(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          plateNumber: form.plateNumber,
          vehicleNumber: form.vehicleNumber || undefined,
          make: form.make || undefined,
          model: form.model || undefined,
          year: form.year ? parseInt(form.year, 10) : undefined,
          color: form.color || undefined,
          chassisNumber: form.chassisNumber || undefined,
          ownershipModel: form.ownershipModel,
          trackingDeviceId: form.trackingDeviceId || undefined,
          fuelCardNumber: form.fuelCardNumber || undefined,
          insuranceExpiry: form.insuranceExpiry || undefined,
          registrationExpiry: form.registrationExpiry || undefined,
          municipalityCardNumber: form.municipalityCardNumber || undefined,
          municipalityCardExpiryDate: form.municipalityCardExpiryDate || undefined,
          advertisingCardNumber: form.advertisingCardNumber || undefined,
          advertisingCardExpiryDate: form.advertisingCardExpiryDate || undefined,
          licenseId: form.licenseId || undefined,
          notes: form.notes || undefined,
        }),
      });
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error ?? "فشل في الحفظ");
      router.push(`/dashboard/companies/${companyId}/vehicles`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header title="إضافة مركبة" subtitle="تسجيل مركبة جديدة" companyId={companyId} />
      <div className="page-container max-w-2xl">
        <div className="mb-2">
          <Link
            href={`/dashboard/companies/${companyId}/vehicles`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight size={14} />
            العودة للمركبات
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* بيانات المركبة الأساسية */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">بيانات المركبة</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">رقم اللوحة <span className="text-red-500">*</span></label>
                <input
                  type="text" required dir="ltr"
                  value={form.plateNumber}
                  onChange={(e) => setField("plateNumber", e.target.value)}
                  className="input-field w-full"
                  placeholder="12345"
                />
              </div>
              <div>
                <label className="form-label">رقم المركبة</label>
                <input
                  type="text" dir="ltr"
                  value={form.vehicleNumber}
                  onChange={(e) => setField("vehicleNumber", e.target.value)}
                  className="input-field w-full"
                  placeholder="V-001"
                />
              </div>
              <div>
                <label className="form-label">الماركة</label>
                <input
                  type="text"
                  value={form.make}
                  onChange={(e) => setField("make", e.target.value)}
                  className="input-field w-full"
                  placeholder="Toyota"
                />
              </div>
              <div>
                <label className="form-label">الموديل</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setField("model", e.target.value)}
                  className="input-field w-full"
                  placeholder="Hiace"
                />
              </div>
              <div>
                <label className="form-label">سنة الصنع</label>
                <input
                  type="number" dir="ltr" min="2000" max="2030"
                  value={form.year}
                  onChange={(e) => setField("year", e.target.value)}
                  className="input-field w-full"
                  placeholder="2024"
                />
              </div>
              <div>
                <label className="form-label">اللون</label>
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setField("color", e.target.value)}
                  className="input-field w-full"
                  placeholder="أبيض"
                />
              </div>
              <div>
                <label className="form-label">رقم الهيكل</label>
                <input
                  type="text" dir="ltr"
                  value={form.chassisNumber}
                  onChange={(e) => setField("chassisNumber", e.target.value)}
                  className="input-field w-full"
                  placeholder="JTMHE3FJ..."
                />
              </div>
              <div>
                <label className="form-label">نمط الملكية</label>
                <select
                  value={form.ownershipModel}
                  onChange={(e) => setField("ownershipModel", e.target.value)}
                  className="input-field w-full"
                >
                  <option value="OWNER_OWNED">مملوكة</option>
                  <option value="RENTED">مؤجرة</option>
                </select>
              </div>
            </div>
          </div>

          {/* الترخيص المرتبط */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">الترخيص</h3>
            <div>
              <label className="form-label">الترخيص المرتبط بالمركبة</label>
              <select
                value={form.licenseId}
                onChange={(e) => setField("licenseId", e.target.value)}
                className="input-field w-full"
              >
                <option value="">— بدون ترخيص —</option>
                {licenses.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.commercialNameAr} — {l.licenseNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* بيانات تتبع ووقود */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">التتبع والوقود</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">رقم جهاز التتبع</label>
                <input
                  type="text" dir="ltr"
                  value={form.trackingDeviceId}
                  onChange={(e) => setField("trackingDeviceId", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">رقم بطاقة الوقود</label>
                <input
                  type="text" dir="ltr"
                  value={form.fuelCardNumber}
                  onChange={(e) => setField("fuelCardNumber", e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* تواريخ الانتهاء */}
          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">تواريخ الانتهاء</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="form-label">انتهاء التأمين</label>
                <input
                  type="date"
                  value={form.insuranceExpiry}
                  onChange={(e) => setField("insuranceExpiry", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">انتهاء التسجيل</label>
                <input
                  type="date"
                  value={form.registrationExpiry}
                  onChange={(e) => setField("registrationExpiry", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">رقم بطاقة البلدية</label>
                <input
                  type="text" dir="ltr"
                  value={form.municipalityCardNumber}
                  onChange={(e) => setField("municipalityCardNumber", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">انتهاء بطاقة البلدية</label>
                <input
                  type="date"
                  value={form.municipalityCardExpiryDate}
                  onChange={(e) => setField("municipalityCardExpiryDate", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">رقم بطاقة الإعلان</label>
                <input
                  type="text" dir="ltr"
                  value={form.advertisingCardNumber}
                  onChange={(e) => setField("advertisingCardNumber", e.target.value)}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="form-label">انتهاء بطاقة الإعلان</label>
                <input
                  type="date"
                  value={form.advertisingCardExpiryDate}
                  onChange={(e) => setField("advertisingCardExpiryDate", e.target.value)}
                  className="input-field w-full"
                />
              </div>
            </div>
          </div>

          {/* ملاحظات */}
          <div>
            <label className="form-label">ملاحظات</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              className="input-field w-full resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? "جاري الحفظ..." : "حفظ المركبة"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/vehicles`}
              className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              إلغاء
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
