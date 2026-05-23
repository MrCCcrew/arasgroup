"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Save, ChevronDown, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";

interface SearchableOption { id: string; label: string; sub?: string }

function SearchableSelect({
  options, value, onChange, placeholder,
}: {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((p) => !p); setQuery(""); }}
        className="input-field w-full flex items-center justify-between text-right"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {selected ? (
            <span>
              {selected.label}
              {selected.sub && <span className="mr-1 text-xs text-muted-foreground">— {selected.sub}</span>}
            </span>
          ) : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && (
            <span
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" />
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg" style={{ maxHeight: "260px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div className="border-b p-2">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرقم الموحد..."
              className="w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              dir="rtl"
            />
          </div>
          <div className="overflow-y-auto">
            <button
              type="button"
              className="w-full px-3 py-2 text-right text-sm text-muted-foreground hover:bg-muted"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              — {placeholder} —
            </button>
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">لا توجد نتائج</p>
            ) : filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`w-full px-3 py-2 text-right text-sm hover:bg-muted ${o.id === value ? "bg-primary/10 font-medium text-primary" : ""}`}
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
              >
                <span>{o.label}</span>
                {o.sub && <span className="mr-2 text-xs text-muted-foreground">{o.sub}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const employeeTypes = {
  ar: [
    { value: "DRIVER", label: "سائق" },
    { value: "DELIVERY_DRIVER", label: "سائق توصيل" },
    { value: "DELIVERY_ADMIN", label: "إداري توصيل" },
    { value: "CAR_WASH_DRIVER", label: "سائق غسيل" },
    { value: "CAR_WASH_WORKER", label: "عامل غسيل" },
    { value: "OFFICE_EMPLOYEE", label: "موظف مكتب" },
    { value: "ACCOUNTANT", label: "محاسب" },
    { value: "MANDOUB", label: "مندوب" },
    { value: "OFFICE_BOY", label: "عامل خدمات" },
    { value: "OTHER", label: "أخرى" },
  ],
  en: [
    { value: "DRIVER", label: "Driver" },
    { value: "DELIVERY_DRIVER", label: "Delivery Driver" },
    { value: "DELIVERY_ADMIN", label: "Delivery Admin" },
    { value: "CAR_WASH_DRIVER", label: "Car Wash Driver" },
    { value: "CAR_WASH_WORKER", label: "Car Wash Worker" },
    { value: "OFFICE_EMPLOYEE", label: "Office Employee" },
    { value: "ACCOUNTANT", label: "Accountant" },
    { value: "MANDOUB", label: "Mandoub" },
    { value: "OFFICE_BOY", label: "Office Boy" },
    { value: "OTHER", label: "Other" },
  ],
} as const;

export default function NewEmployeePage() {
  const router = useRouter();
  const params = useParams<{ companyId: string }>();
  const { locale } = useLocale();
  const companyId = params.companyId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<{ id: string; nameAr: string; nameEn?: string | null; unifiedEntityNumber?: string | null }[]>([]);
  const [positions, setPositions] = useState<{ id: string; nameAr: string; nameEn?: string | null }[]>([]);
  const [licenses, setLicenses] = useState<{ id: string; commercialNameAr: string; licenseNumber: string; unifiedEntityNumber?: string | null }[]>([]);
  const [groupLicenses, setGroupLicenses] = useState<{ id: string; commercialNameAr: string; licenseNumber: string; unifiedEntityNumber?: string | null; company?: { nameAr: string } }[]>([]);
  const [additionalLicenseIds, setAdditionalLicenseIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    employeeNumber: "",
    nameAr: "",
    nameEn: "",
    type: "OFFICE_EMPLOYEE",
    positionId: "",
    branchId: "",
    licenseId: "",
    nationality: "",
    civilId: "",
    passportNumber: "",
    residencyNumber: "",
    residencyExpiry: "",
    licenseNumber: "",
    licenseExpiry: "",
    phone: "",
    joinDate: "",
    baseSalary: "",
    bankAccountNumber: "",
    notes: "",
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()),
      fetch(`/api/hr/positions?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/licenses?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/licenses?groupWide=true&excludeCompanyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([branchesPayload, positionsPayload, licensesPayload, groupPayload]) => {
        if (branchesPayload.success) setBranches(branchesPayload.data);
        if (positionsPayload.success) setPositions(positionsPayload.data);
        if (licensesPayload.success) setLicenses(licensesPayload.data);
        if (groupPayload.success) setGroupLicenses(groupPayload.data);
      })
      .catch(() => {
        setError(locale === "en" ? "Failed to load lookup data" : "تعذر تحميل البيانات المساعدة");
      });
  }, [companyId, locale]);

  function setField(field: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          employeeNumber: form.employeeNumber || undefined,
          nameAr: form.nameAr,
          nameEn: form.nameEn || undefined,
          type: form.type,
          positionId: form.positionId || undefined,
          branchId: form.branchId || undefined,
          licenseId: form.licenseId || undefined,
          additionalLicenseIds: additionalLicenseIds.length > 0 ? additionalLicenseIds : undefined,
          nationality: form.nationality || undefined,
          civilId: form.civilId || undefined,
          passportNumber: form.passportNumber || undefined,
          residencyNumber: form.residencyNumber || undefined,
          residencyExpiry: form.residencyExpiry || undefined,
          licenseNumber: form.licenseNumber || undefined,
          licenseExpiry: form.licenseExpiry || undefined,
          phone: form.phone || undefined,
          joinDate: form.joinDate || undefined,
          baseSalary: form.baseSalary ? parseFloat(form.baseSalary) : undefined,
          bankAccountNumber: form.bankAccountNumber || undefined,
          notes: form.notes || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (locale === "en" ? "Failed to save employee" : "فشل في حفظ الموظف"));
      router.push(`/dashboard/companies/${companyId}/hr/employees`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : locale === "en" ? "Unexpected error" : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header
        title={locale === "en" ? "New Employee" : "موظف جديد"}
        subtitle={locale === "en" ? "Add a new employee to company records" : "إضافة موظف إلى سجلات الشركة"}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <Link
            href={`/dashboard/companies/${companyId}/hr/employees`}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight size={14} />
            {locale === "en" ? "Back to employees" : "العودة للموظفين"}
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="section-card space-y-6">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Basic information" : "البيانات الأساسية"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Employee code" : "رقم الموظف"}</label>
                <input type="text" value={form.employeeNumber} onChange={(event) => setField("employeeNumber", event.target.value)} className="input-field w-full" placeholder="EMP-001" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Branch" : "الفرع"}</label>
                <SearchableSelect
                  value={form.branchId}
                  onChange={(id) => setField("branchId", id)}
                  placeholder={locale === "en" ? "Select branch" : "اختر الفرع"}
                  options={branches.map((b) => ({
                    id: b.id,
                    label: locale === "en" ? (b.nameEn ?? b.nameAr) : b.nameAr,
                    sub: b.unifiedEntityNumber ?? undefined,
                  }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "License" : "الترخيص"}</label>
                <SearchableSelect
                  value={form.licenseId}
                  onChange={(id) => setField("licenseId", id)}
                  placeholder={locale === "en" ? "Select license" : "اختر الترخيص"}
                  options={licenses.map((l) => ({
                    id: l.id,
                    label: `${l.commercialNameAr} (${l.licenseNumber})`,
                    sub: l.unifiedEntityNumber ?? undefined,
                  }))}
                />
              </div>
              {/* التراخيص الإضافية — للإداريين العابرين للشركات */}
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Additional licenses (cross-company admin)" : "تراخيص إضافية (إداري عابر للشركات)"}
                </label>
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {additionalLicenseIds.map((lid) => {
                      const lic = licenses.find((l) => l.id === lid);
                      if (!lic) return null;
                      return (
                        <span key={lid} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          {lic.commercialNameAr} ({lic.licenseNumber})
                          <button type="button" onClick={() => setAdditionalLicenseIds((p) => p.filter((x) => x !== lid))} className="hover:text-red-500">×</button>
                        </span>
                      );
                    })}
                    {additionalLicenseIds.length === 0 && (
                      <p className="text-xs text-muted-foreground">{locale === "en" ? "No additional licenses selected" : "لم يتم اختيار تراخيص إضافية"}</p>
                    )}
                  </div>
                  <select
                    className="input-field w-full text-sm"
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val && !additionalLicenseIds.includes(val)) {
                        setAdditionalLicenseIds((p) => [...p, val]);
                      }
                    }}
                  >
                    <option value="">{locale === "en" ? "— Add license from another company —" : "— أضف ترخيصاً من شركة أخرى —"}</option>
                    {groupLicenses
                      .filter((l) => !additionalLicenseIds.includes(l.id))
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.company?.nameAr ? `[${l.company.nameAr}] ` : ""}{l.commercialNameAr} ({l.licenseNumber}){l.unifiedEntityNumber ? ` — ${l.unifiedEntityNumber}` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Position" : "المسمى الوظيفي"}</label>
                <select value={form.positionId} onChange={(event) => setField("positionId", event.target.value)} className="input-field w-full">
                  <option value="">{locale === "en" ? "Select position" : "اختر الوظيفة"}</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {locale === "en" ? position.nameEn ?? position.nameAr : position.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Arabic name" : "الاسم بالعربي"} <span className="text-red-500">*</span>
                </label>
                <input type="text" required value={form.nameAr} onChange={(event) => setField("nameAr", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "Full name" : "الاسم الكامل"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "English name" : "الاسم بالإنجليزي"}</label>
                <input type="text" value={form.nameEn} onChange={(event) => setField("nameEn", event.target.value)} className="input-field w-full" placeholder="Full name" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  {locale === "en" ? "Employee type" : "الوظيفة"} <span className="text-red-500">*</span>
                </label>
                <select required value={form.type} onChange={(event) => setField("type", event.target.value)} className="input-field w-full">
                  {employeeTypes[locale].map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Nationality" : "الجنسية"}</label>
                <input type="text" value={form.nationality} onChange={(event) => setField("nationality", event.target.value)} className="input-field w-full" placeholder={locale === "en" ? "Example: Egyptian, Indian" : "مثال: مصري، هندي"} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Phone number" : "رقم الهاتف"}</label>
                <input type="tel" value={form.phone} onChange={(event) => setField("phone", event.target.value)} className="input-field w-full" placeholder="+965XXXXXXXX" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Joining date" : "تاريخ الالتحاق"}</label>
                <input type="date" value={form.joinDate} onChange={(event) => setField("joinDate", event.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Base salary (KWD)" : "الراتب الأساسي (د.ك)"}</label>
                <input type="number" step="0.001" min="0" value={form.baseSalary} onChange={(event) => setField("baseSalary", event.target.value)} className="input-field w-full" placeholder="0.000" dir="ltr" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {locale === "en" ? "Identity and documents" : "الوثائق والهوية"}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Civil ID" : "رقم البطاقة المدنية"}</label>
                <input type="text" value={form.civilId} onChange={(event) => setField("civilId", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Passport number" : "رقم الجواز"}</label>
                <input type="text" value={form.passportNumber} onChange={(event) => setField("passportNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Residency number" : "رقم الإقامة"}</label>
                <input type="text" value={form.residencyNumber} onChange={(event) => setField("residencyNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Residency expiry date" : "تاريخ انتهاء الإقامة"}</label>
                <input type="date" value={form.residencyExpiry} onChange={(event) => setField("residencyExpiry", event.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Driving license number" : "رقم الرخصة"}</label>
                <input type="text" value={form.licenseNumber} onChange={(event) => setField("licenseNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Driving license expiry" : "تاريخ انتهاء الرخصة"}</label>
                <input type="date" value={form.licenseExpiry} onChange={(event) => setField("licenseExpiry", event.target.value)} className="input-field w-full" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Bank account number" : "رقم الحساب البنكي"}</label>
                <input type="text" value={form.bankAccountNumber} onChange={(event) => setField("bankAccountNumber", event.target.value)} className="input-field w-full" dir="ltr" />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Notes" : "ملاحظات"}</label>
            <textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} rows={3} className="input-field w-full resize-none" placeholder={locale === "en" ? "Any additional notes..." : "أي ملاحظات إضافية..."} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Save size={16} />
              {loading ? (locale === "en" ? "Saving..." : "جاري الحفظ...") : locale === "en" ? "Save employee" : "حفظ الموظف"}
            </button>
            <Link href={`/dashboard/companies/${companyId}/hr/employees`} className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted">
              {locale === "en" ? "Cancel" : "إلغاء"}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
