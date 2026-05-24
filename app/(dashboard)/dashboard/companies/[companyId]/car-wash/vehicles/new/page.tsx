"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface DriverOption {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  employeeNumber?: string | null;
}

export default function NewCarWashVehiclePage() {
  const router = useRouter();
  const { companyId } = useParams<{ companyId: string }>();
  const { locale } = useLocale();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [form, setForm] = useState({
    code: "",
    nameAr: "",
    nameEn: "",
    plateNumber: "",
    make: "",
    model: "",
    year: "",
    color: "",
    knetDeviceId: "",
    assignedDriverEmployeeId: "",
  });

  useEffect(() => {
    fetch(`/api/hr/employees?companyId=${companyId}&type=CAR_WASH_DRIVER`)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success) setDrivers(payload.data);
      })
      .catch(() => {});
  }, [companyId]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/car-wash/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          code: form.code,
          nameAr: form.nameAr,
          nameEn: form.nameEn || undefined,
          plateNumber: form.plateNumber,
          make: form.make || undefined,
          model: form.model || undefined,
          year: form.year ? Number.parseInt(form.year, 10) : undefined,
          color: form.color || undefined,
          knetDeviceId: form.knetDeviceId || undefined,
          assignedDriverEmployeeId: form.assignedDriverEmployeeId || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Save failed" : "فشل في الحفظ"));
      router.push(`/dashboard/companies/${companyId}/car-wash/vehicles`);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Save failed" : "فشل في الحفظ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header title={locale === "en" ? "New Car Wash Vehicle" : "إضافة مركبة غسيل"} subtitle={locale === "en" ? "Register a new vehicle" : "تسجيل مركبة جديدة"} companyId={companyId} />
      <div className="page-container max-w-2xl">
        <div className="mb-2 flex items-center gap-2">
          <Link href={`/dashboard/companies/${companyId}/car-wash/vehicles`} className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowRight size={14} />
            {locale === "en" ? "Back to vehicles" : "العودة للمركبات"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Wash details" : "بيانات الغسيل"}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Code" : "الكود"} <span className="text-red-500">*</span></label>
                <input type="text" required value={form.code} onChange={(event) => setField("code", event.target.value)} className="input-field w-full" placeholder="CW-01" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Arabic name" : "الاسم بالعربي"} <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nameAr} onChange={(event) => setField("nameAr", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "Arabic display name" : "غسيل ١"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "English name" : "الاسم بالإنجليزي"}</label>
                <input type="text" value={form.nameEn} onChange={(event) => setField("nameEn", event.target.value)} className="input-field w-full" placeholder="Car Wash 1" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "KNET device ID" : "رقم جهاز KNET"}</label>
                <input type="text" value={form.knetDeviceId} onChange={(event) => setField("knetDeviceId", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "Device number" : "رقم الجهاز"} dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Assigned driver" : "السائق الحالي"}</label>
                <select
                  value={form.assignedDriverEmployeeId}
                  onChange={(event) => setField("assignedDriverEmployeeId", event.target.value)}
                  className="input-field w-full"
                >
                  <option value="">{locale === "en" ? "Select driver" : "اختر السائق"}</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {locale === "en" ? driver.nameEn ?? driver.nameAr : driver.nameAr}
                      {driver.employeeNumber ? ` - ${driver.employeeNumber}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{locale === "en" ? "Vehicle details" : "بيانات المركبة"}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Plate number" : "رقم اللوحة"} <span className="text-red-500">*</span></label>
                <input type="text" required value={form.plateNumber} onChange={(event) => setField("plateNumber", event.target.value)} className="input-field w-full" placeholder="12345" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Make" : "الماركة"}</label>
                <input type="text" value={form.make} onChange={(event) => setField("make", event.target.value)} className="input-field w-full" placeholder="Toyota" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Model" : "الموديل"}</label>
                <input type="text" value={form.model} onChange={(event) => setField("model", event.target.value)} className="input-field w-full" placeholder="Hiace" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Manufacturing year" : "سنة الصنع"}</label>
                <input type="number" min="2000" max="2030" value={form.year} onChange={(event) => setField("year", event.target.value)} className="input-field w-full" placeholder="2024" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Color" : "اللون"}</label>
                <input type="text" value={form.color} onChange={(event) => setField("color", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "White" : "أبيض"} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جارٍ الحفظ...") : locale === "en" ? "Save vehicle" : "حفظ المركبة"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/car-wash/vehicles`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
