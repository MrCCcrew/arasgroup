"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Save } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

const TICKET_TYPES = {
  ar: [
    { value: "ANNUAL_LEAVE", label: "إجازة سنوية" },
    { value: "EMERGENCY", label: "طارئ" },
    { value: "RESIGNATION", label: "استقالة" },
    { value: "END_OF_SERVICE", label: "نهاية خدمة" },
    { value: "OTHER", label: "أخرى" },
  ],
  en: [
    { value: "ANNUAL_LEAVE", label: "Annual Leave" },
    { value: "EMERGENCY", label: "Emergency" },
    { value: "RESIGNATION", label: "Resignation" },
    { value: "END_OF_SERVICE", label: "End of Service" },
    { value: "OTHER", label: "Other" },
  ],
} as const;

interface Employee {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  type: string;
}

export default function NewTicketPage() {
  const params = useParams<{ companyId: string }>();
  const { companyId } = params;
  const { locale } = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [form, setForm] = useState({
    employeeId: "",
    type: "ANNUAL_LEAVE",
    destination: "",
    travelDate: "",
    returnDate: "",
    cost: "",
    paidBy: "",
    notes: "",
  });

  useEffect(() => {
    fetch(`/api/hr/employees?companyId=${companyId}`)
      .then((r) => r.json())
      .then((payload) => { if (payload.success) setEmployees(payload.data); })
      .catch(() => setError(locale === "en" ? "Failed to load employees" : "تعذر تحميل الموظفين"));
  }, [companyId, locale]);

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId) {
      setError(locale === "en" ? "Please select an employee" : "الرجاء اختيار الموظف");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/hr/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          type: form.type,
          destination: form.destination || undefined,
          travelDate: form.travelDate || undefined,
          returnDate: form.returnDate || undefined,
          cost: form.cost ? parseFloat(form.cost) : undefined,
          paidBy: form.paidBy || undefined,
          notes: form.notes || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      router.push(`/dashboard/companies/${companyId}/hr/tickets`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === "en" ? "Unexpected error" : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "Add Travel Ticket" : "إضافة تذكرة سفر"}
        subtitle={locale === "en" ? "Record a travel ticket for an employee" : "تسجيل تذكرة سفر لموظف"}
        companyId={companyId}
      />
      <div className="page-container max-w-2xl">
        <Link
          href={`/dashboard/companies/${companyId}/hr/tickets`}
          className="mb-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight size={14} />
          {locale === "en" ? "Back to tickets" : "العودة للتذاكر"}
        </Link>

        <form onSubmit={handleSubmit} className="section-card space-y-5">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Employee" : "الموظف"} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.employeeId}
                onChange={(e) => setField("employeeId", e.target.value)}
                className="input-field w-full"
              >
                <option value="">{locale === "en" ? "Select employee" : "اختر الموظف"}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {locale === "en" ? emp.nameEn ?? emp.nameAr : emp.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {locale === "en" ? "Ticket type" : "نوع التذكرة"} <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
                className="input-field w-full"
              >
                {TICKET_TYPES[locale].map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Destination" : "الوجهة"}</label>
              <input
                type="text"
                value={form.destination}
                onChange={(e) => setField("destination", e.target.value)}
                className="input-field w-full"
                placeholder={locale === "en" ? "Egypt, India..." : "مصر، الهند..."}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Travel date" : "تاريخ السفر"}</label>
              <input
                type="date"
                value={form.travelDate}
                onChange={(e) => setField("travelDate", e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Return date" : "تاريخ العودة"}</label>
              <input
                type="date"
                value={form.returnDate}
                onChange={(e) => setField("returnDate", e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Ticket cost (KWD)" : "تكلفة التذكرة (د.ك)"}</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={form.cost}
                onChange={(e) => setField("cost", e.target.value)}
                className="input-field w-full"
                placeholder="0.000"
                dir="ltr"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Paid by" : "يدفعها"}</label>
              <select
                value={form.paidBy}
                onChange={(e) => setField("paidBy", e.target.value)}
                className="input-field w-full"
              >
                <option value="">{locale === "en" ? "Not specified" : "غير محدد"}</option>
                <option value="COMPANY">{locale === "en" ? "Company" : "الشركة"}</option>
                <option value="INVESTOR">{locale === "en" ? "Investor" : "المستثمر"}</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save ticket" : "حفظ التذكرة"}
            </button>
            <Link
              href={`/dashboard/companies/${companyId}/hr/tickets`}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
