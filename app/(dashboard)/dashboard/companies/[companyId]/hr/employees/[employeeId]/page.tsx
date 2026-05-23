"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { useLocale } from "@/components/providers/locale-provider";
import { formatDate, formatKWD } from "@/lib/utils";

const DOC_TYPES = {
  ar: [
    { value: "EMPLOYEE:WORK_PERMIT",      label: "إذن العمل"        },
    { value: "EMPLOYEE:PASSPORT",          label: "جواز السفر"       },
    { value: "EMPLOYEE:CIVIL_ID",          label: "البطاقة المدنية"  },
    { value: "EMPLOYEE:RESIDENCY",         label: "الإقامة"          },
    { value: "EMPLOYEE:DRIVING_LICENSE",   label: "رخصة القيادة"     },
    { value: "EMPLOYEE:CERTIFICATE",       label: "شهادة / مؤهل"    },
    { value: "EMPLOYEE:OTHER",             label: "مرفق آخر"         },
  ],
  en: [
    { value: "EMPLOYEE:WORK_PERMIT",      label: "Work permit"              },
    { value: "EMPLOYEE:PASSPORT",          label: "Passport"                 },
    { value: "EMPLOYEE:CIVIL_ID",          label: "Civil ID"                 },
    { value: "EMPLOYEE:RESIDENCY",         label: "Residency"                },
    { value: "EMPLOYEE:DRIVING_LICENSE",   label: "Driving license"          },
    { value: "EMPLOYEE:CERTIFICATE",       label: "Certificate / Qualification" },
    { value: "EMPLOYEE:OTHER",             label: "Other attachment"         },
  ],
} as const;

const EMPLOYEE_TYPE_LABELS = {
  ar: {
    DRIVER: "سائق",
    DELIVERY_DRIVER: "سائق توصيل",
    DELIVERY_ADMIN: "إداري توصيل",
    CAR_WASH_DRIVER: "سائق غسيل",
    CAR_WASH_WORKER: "عامل غسيل",
    OFFICE_EMPLOYEE: "موظف مكتب",
    ACCOUNTANT: "محاسب",
    MANDOUB: "مندوب",
    OFFICE_BOY: "عامل خدمات",
    OTHER: "أخرى",
  },
  en: {
    DRIVER: "Driver",
    DELIVERY_DRIVER: "Delivery Driver",
    DELIVERY_ADMIN: "Delivery Admin",
    CAR_WASH_DRIVER: "Car Wash Driver",
    CAR_WASH_WORKER: "Car Wash Worker",
    OFFICE_EMPLOYEE: "Office Employee",
    ACCOUNTANT: "Accountant",
    MANDOUB: "Mandoub",
    OFFICE_BOY: "Office Boy",
    OTHER: "Other",
  },
} as const;

interface Attachment {
  id: string;
  fileName: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  refModule: string;
  createdAt: string;
}

interface Employee {
  id: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  nationality?: string;
  civilId?: string;
  passportNumber?: string;
  residencyNumber?: string;
  residencyExpiry?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  phone?: string;
  joinDate?: string;
  baseSalary?: number;
  bankAccountNumber?: string;
  employeeNumber?: string;
  notes?: string;
  branch?: { nameAr: string; nameEn?: string };
}

function FileIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <span className="text-xl text-blue-500">🖼</span>;
  if (type === "application/pdf") return <FileText className="h-5 w-5 text-red-500" />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  return <File className="h-5 w-5 text-gray-500" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmployeeDetailPage() {
  const params = useParams<{ companyId: string; employeeId: string }>();
  const { companyId, employeeId } = params;
  const { locale } = useLocale();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("EMPLOYEE:PASSPORT");
  const [preview, setPreview] = useState<Attachment | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [employeeResponse, attachmentResponse] = await Promise.all([
      fetch(`/api/hr/employees/${employeeId}`),
      fetch(`/api/hr/employees/${employeeId}/attachments`),
    ]);
    const employeePayload = await employeeResponse.json();
    const attachmentPayload = await attachmentResponse.json();
    if (employeePayload.success) setEmployee(employeePayload.data);
    if (attachmentPayload.success) setAttachments(attachmentPayload.data);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("refModule", docType);
      formData.append("refId", employeeId);
      const response = await fetch("/api/storage/upload", { method: "POST", body: formData });
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.error);
      await load();
    } catch (uploadError) {
      window.alert(uploadError instanceof Error ? uploadError.message : locale === "en" ? "Upload failed" : "فشل الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(attachment: Attachment) {
    const confirmed = window.confirm(
      locale === "en" ? `Delete "${attachment.originalName}"?` : `حذف "${attachment.originalName}"؟`,
    );
    if (!confirmed) return;
    await fetch(`/api/hr/employees/${employeeId}/attachments?id=${attachment.id}`, { method: "DELETE" });
    setAttachments((previous) => previous.filter((item) => item.id !== attachment.id));
  }

  const grouped = DOC_TYPES[locale]
    .map((docTypeItem) => ({
      ...docTypeItem,
      items: attachments.filter((attachment) => attachment.refModule === docTypeItem.value),
    }))
    .filter((group) => group.items.length > 0);

  if (loading) {
    return (
      <div className="page-container">
        <p className="text-muted-foreground">{locale === "en" ? "Loading..." : "جاري التحميل..."}</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-container">
        <p className="text-red-500">{locale === "en" ? "Employee not found" : "الموظف غير موجود"}</p>
      </div>
    );
  }

  const employeeName = locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr;
  const branchName = employee.branch ? (locale === "en" ? employee.branch.nameEn ?? employee.branch.nameAr : employee.branch.nameAr) : null;

  return (
    <div>
      <Header title={employeeName} subtitle={EMPLOYEE_TYPE_LABELS[locale][employee.type as keyof typeof EMPLOYEE_TYPE_LABELS.ar] ?? employee.type} companyId={companyId} />
      <div className="page-container max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/companies/${companyId}/hr/employees`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowRight size={14} />
            {locale === "en" ? "Back to employees" : "العودة للموظفين"}
          </Link>
          <Link
            href={`/dashboard/companies/${companyId}/hr/employees/${employeeId}/edit`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Pencil size={14} />
            {locale === "en" ? "Edit" : "تعديل"}
          </Link>
        </div>

        <div className="section-card">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {locale === "en" ? "Basic information" : "البيانات الأساسية"}
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
            {employee.employeeNumber && <Row label={locale === "en" ? "Employee code" : "رقم الموظف"} value={employee.employeeNumber} />}
            {branchName && <Row label={locale === "en" ? "Branch / License" : "الفرع / الرخصة"} value={branchName} />}
            {employee.nationality && <Row label={locale === "en" ? "Nationality" : "الجنسية"} value={employee.nationality} />}
            {employee.phone && <Row label={locale === "en" ? "Phone" : "الهاتف"} value={employee.phone} />}
            {employee.civilId && <Row label={locale === "en" ? "Civil ID" : "الرقم المدني"} value={employee.civilId} />}
            {employee.passportNumber && <Row label={locale === "en" ? "Passport No." : "رقم الجواز"} value={employee.passportNumber} />}
            {employee.residencyNumber && <Row label={locale === "en" ? "Residency No." : "رقم الإقامة"} value={employee.residencyNumber} />}
            {employee.residencyExpiry && <Row label={locale === "en" ? "Residency expiry" : "انتهاء الإقامة"} value={formatDate(employee.residencyExpiry, locale === "en" ? "en-US" : "ar-KW")} />}
            {employee.licenseNumber && <Row label={locale === "en" ? "License No." : "رقم الرخصة"} value={employee.licenseNumber} />}
            {employee.baseSalary !== undefined && <Row label={locale === "en" ? "Base salary" : "الراتب الأساسي"} value={formatKWD(Number(employee.baseSalary), locale === "en" ? "en-US" : "ar-KW")} />}
            {employee.joinDate && <Row label={locale === "en" ? "Join date" : "تاريخ الالتحاق"} value={formatDate(employee.joinDate, locale === "en" ? "en-US" : "ar-KW")} />}
            {employee.bankAccountNumber && <Row label={locale === "en" ? "Bank account" : "حساب بنكي"} value={employee.bankAccountNumber} />}
            {employee.notes && (
              <div className="col-span-2 md:col-span-3">
                <Row label={locale === "en" ? "Notes" : "ملاحظات"} value={employee.notes} />
              </div>
            )}
          </div>
        </div>

        <div className="section-card space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {locale === "en" ? "Documents & Attachments" : "المستندات والمرفقات"}
          </h3>

          {/* زراير أنواع المرفقات */}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={handleUpload}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {DOC_TYPES[locale].map((item) => {
              const count = attachments.filter((a) => a.refModule === item.value).length;
              const isUploading = uploading && docType === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setDocType(item.value);
                    setTimeout(() => fileRef.current?.click(), 0);
                  }}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-sm font-medium transition-all
                    ${isUploading
                      ? "border-primary/50 bg-primary/5 opacity-70"
                      : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                    }`}
                >
                  {isUploading ? (
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Upload size={22} className="text-muted-foreground" />
                  )}
                  <span className="text-xs leading-tight">{item.label}</span>
                  {count > 0 && (
                    <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* المرفقات المرفوعة مجمّعة حسب النوع */}
          {attachments.length > 0 && (
            <div className="space-y-4 pt-2">
              {grouped.map((group) => (
                <div key={group.value}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {group.items.map((attachment) => (
                      <AttachmentCard key={attachment.id} attachment={attachment} onDelete={handleDelete} onPreview={setPreview} locale={locale} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-4">
              <p className="text-sm font-medium">{preview.originalName}</p>
              <div className="flex items-center gap-2">
                <a href={preview.filePath} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                  <Eye size={13} />
                  {locale === "en" ? "Open / Print" : "فتح / طباعة"}
                </a>
                <button onClick={() => setPreview(null)} className="rounded-lg p-1.5 hover:bg-muted">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex min-h-[300px] items-center justify-center p-4">
              {preview.fileType.startsWith("image/") ? (
                <img src={preview.filePath} alt={preview.originalName} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
              ) : preview.fileType === "application/pdf" ? (
                <iframe src={preview.filePath} className="h-[70vh] w-full rounded-lg" title={preview.originalName} />
              ) : (
                <div className="space-y-3 text-center">
                  <FileText size={48} className="mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {locale === "en" ? "Preview is not available for this file type" : "المعاينة غير متاحة لهذا النوع من الملفات"}
                  </p>
                  <a href={preview.filePath} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
                    <Eye size={14} />
                    {locale === "en" ? "Download / Open" : "تحميل / فتح"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function AttachmentCard({
  attachment,
  onDelete,
  onPreview,
  locale,
}: {
  attachment: Attachment;
  onDelete: (attachment: Attachment) => void;
  onPreview: (attachment: Attachment) => void;
  locale: "ar" | "en";
}) {
  const isImage = attachment.fileType.startsWith("image/");
  return (
    <div className="group relative cursor-pointer overflow-hidden rounded-lg border bg-muted/20 transition-colors hover:border-primary/50" onClick={() => onPreview(attachment)}>
      {isImage ? (
        <img src={attachment.filePath} alt={attachment.originalName} className="h-24 w-full object-cover" />
      ) : (
        <div className="flex h-24 w-full items-center justify-center bg-muted/40">
          <FileIcon type={attachment.fileType} />
        </div>
      )}
      <div className="p-2">
        <p className="truncate text-xs font-medium">{attachment.originalName}</p>
        <p className="text-xs text-muted-foreground">{formatSize(attachment.fileSize)}</p>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onDelete(attachment);
        }}
        className="absolute left-1 top-1 rounded-md bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        title={locale === "en" ? "Delete" : "حذف"}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
