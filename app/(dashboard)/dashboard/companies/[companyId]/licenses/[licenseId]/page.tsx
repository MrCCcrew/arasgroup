"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight, Paperclip, Trash2, Upload, X, Pencil,
  Users, FileText, Building2, AlertTriangle,
} from "lucide-react";
import { Header } from "@/components/layout/header";

interface MainLicense { id: string; commercialNameAr: string; licenseNumber: string; status: string }
interface SubLicense {
  id: string; commercialNameAr: string; licenseNumber: string; status: string;
  branch: { nameAr: string } | null;
  investor: { nameAr: string } | null;
  _count: { employees: number };
}
interface Employee {
  id: string; nameAr: string; type: string; employmentStatus: string;
  nationality: string | null; civilId: string | null;
}
interface Attachment {
  id: string; originalName: string; fileName: string; mimeType: string | null;
  fileSize: number; filePath: string; notes: string | null;
  documentCategory: string | null; createdAt: string;
}
interface Branch { id: string; nameAr: string }
interface Investor { id: string; nameAr: string }
interface LicenseDetail {
  id: string;
  commercialNameAr: string; commercialNameEn: string | null;
  licenseNumber: string; isMainLicense: boolean;
  status: string;
  branchId: string | null; investorId: string | null;
  issueDate: string | null; licenseExpiryDate: string | null;
  fireLicenseExpiryDate: string | null; healthLicenseExpiryDate: string | null;
  advertisingLicenseExpiryDate: string | null;
  managerName: string | null; managerPhone: string | null;
  unifiedEntityNumber: string | null; civilEntityNumber: string | null;
  fileNumber: string | null; notes: string | null;
  branch: { nameAr: string } | null;
  investor: { nameAr: string } | null;
  mainLicense: MainLicense | null;
  branchLicenses: SubLicense[];
  employees: Employee[];
  _count: { employees: number; branchLicenses: number };
}

const LICENSE_DOC_TYPES = [
  { value: "LICENSE:COMMERCIAL", label: "الترخيص التجاري" },
  { value: "LICENSE:FIRE", label: "رخصة الإطفاء" },
  { value: "LICENSE:HEALTH", label: "الرخصة الصحية" },
  { value: "LICENSE:ADVERTISING", label: "رخصة الإعلانات" },
  { value: "LICENSE:LEASE", label: "عقد الإيجار" },
  { value: "LICENSE:OTHER", label: "مرفق آخر" },
];

const EMPTY_EDIT = {
  commercialNameAr: "", commercialNameEn: "", licenseNumber: "",
  status: "ACTIVE", branchId: "", investorId: "",
  issueDate: "", licenseExpiryDate: "",
  fireLicenseExpiryDate: "", healthLicenseExpiryDate: "", advertisingLicenseExpiryDate: "",
  managerName: "", managerPhone: "", unifiedEntityNumber: "", civilEntityNumber: "",
  fileNumber: "", notes: "",
};
type EditForm = typeof EMPTY_EDIT;

function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ label, date }: { label: string; date: string | null | undefined }) {
  if (!date) return null;
  const days = daysLeft(date);
  const formatted = new Date(date).toLocaleDateString("ar-KW");
  const color =
    days === null ? "bg-gray-100 text-gray-600" :
    days < 0 ? "bg-red-100 text-red-700 font-bold" :
    days <= 30 ? "bg-red-50 text-red-600 font-medium" :
    days <= 90 ? "bg-orange-50 text-orange-600 font-medium" :
    "bg-green-50 text-green-700";
  const daysNote = days !== null && days >= 0 && days <= 90
    ? ` (${days} يوم)`
    : days !== null && days < 0 ? " (منتهي)" : "";
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${color}`}>
      <span className="text-xs opacity-70">{label}</span>
      <span>{formatted}{daysNote}</span>
    </div>
  );
}

function Modal({ title, wide, onClose, children }: {
  title: string; wide?: boolean; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-sm"} max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  EXPIRED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  INACTIVE: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-rose-100 text-rose-700",
};
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "نشط", EXPIRED: "منتهي", SUSPENDED: "موقوف", INACTIVE: "غير نشط", CANCELLED: "ملغاة",
};

export default function LicenseDetailPage() {
  const { companyId, licenseId } = useParams<{ companyId: string; licenseId: string }>();
  const router = useRouter();

  const [license, setLicense] = useState<LicenseDetail | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_EDIT);
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteAttId, setDeleteAttId] = useState<string | null>(null);
  const [deletingAtt, setDeletingAtt] = useState(false);
  const [currentDocType, setCurrentDocType] = useState("LICENSE:COMMERCIAL");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [licRes, attRes, brRes, invRes] = await Promise.all([
      fetch(`/api/licenses/${licenseId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/licenses/${licenseId}/attachments`).then((r) => r.json()).catch(() => null),
      fetch(`/api/companies/${companyId}/branches`).then((r) => r.json()).catch(() => null),
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()).catch(() => null),
    ]);
    if (licRes?.success) setLicense(licRes.data);
    else setPageError(licRes?.error ?? "فشل في جلب بيانات الترخيص");
    if (attRes?.success) setAttachments(attRes.data);
    if (brRes?.success) setBranches(brRes.data);
    if (invRes?.success) setInvestors(invRes.data);
    setLoading(false);
  }, [licenseId]);

  useEffect(() => { load(); }, [load]);

  function openEdit() {
    if (!license) return;
    setEditForm({
      commercialNameAr: license.commercialNameAr,
      commercialNameEn: license.commercialNameEn ?? "",
      licenseNumber: license.licenseNumber,
      status: license.status,
      branchId: license.branchId ?? "",
      investorId: license.investorId ?? "",
      issueDate: license.issueDate?.slice(0, 10) ?? "",
      licenseExpiryDate: license.licenseExpiryDate?.slice(0, 10) ?? "",
      fireLicenseExpiryDate: license.fireLicenseExpiryDate?.slice(0, 10) ?? "",
      healthLicenseExpiryDate: license.healthLicenseExpiryDate?.slice(0, 10) ?? "",
      advertisingLicenseExpiryDate: license.advertisingLicenseExpiryDate?.slice(0, 10) ?? "",
      managerName: license.managerName ?? "",
      managerPhone: license.managerPhone ?? "",
      unifiedEntityNumber: license.unifiedEntityNumber ?? "",
      civilEntityNumber: license.civilEntityNumber ?? "",
      fileNumber: license.fileNumber ?? "",
      notes: license.notes ?? "",
    });
    setEditError("");
    setShowEdit(true);
  }

  function ef<K extends keyof EditForm>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditForm((p) => ({ ...p, [key]: e.target.value }));
  }

  async function saveEdit() {
    if (!editForm.commercialNameAr.trim()) { setEditError("الاسم التجاري مطلوب"); return; }
    setSaving(true); setEditError("");
    const body: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(editForm)) {
      body[k] = (v as string) || null;
    }
    const res = await fetch(`/api/licenses/${licenseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!data.success) { setEditError(data.error ?? "حدث خطأ"); return; }
    setShowEdit(false);
    load();
  }

  async function confirmDelete() {
    setDeleting(true); setDeleteError("");
    const res = await fetch(`/api/licenses/${licenseId}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.success) { setDeleteError(data.error ?? "فشل الحذف"); return; }
    router.push(`/dashboard/companies/${companyId}/licenses`);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true); setUploadError("");
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("documentCategory", currentDocType);
      const res = await fetch(`/api/licenses/${licenseId}/attachments`, { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) { setUploadError(data.error ?? "فشل في رفع الملف"); break; }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    load();
  }

  async function deleteAttachment(attId: string) {
    setDeletingAtt(true);
    await fetch(`/api/licenses/${licenseId}/attachments?attachmentId=${attId}`, { method: "DELETE" });
    setDeletingAtt(false);
    setDeleteAttId(null);
    load();
  }

  if (loading) {
    return (
      <div>
        <Header title="تفاصيل الترخيص" companyId={companyId} />
        <div className="py-20 text-center text-sm text-muted-foreground">جاري التحميل...</div>
      </div>
    );
  }

  if (pageError || !license) {
    return (
      <div>
        <Header title="تفاصيل الترخيص" companyId={companyId} />
        <div className="page-container">
          <div className="section-card text-center text-red-600">{pageError || "الترخيص غير موجود"}</div>
        </div>
      </div>
    );
  }

  const expDates = [
    { label: "الترخيص التجاري", date: license.licenseExpiryDate },
    { label: "رخصة الإطفاء", date: license.fireLicenseExpiryDate },
    { label: "الترخيص الصحي", date: license.healthLicenseExpiryDate },
    { label: "رخصة الإعلانات", date: license.advertisingLicenseExpiryDate },
  ].filter((d) => d.date);

  return (
    <div>
      <Header
        title={license.commercialNameAr}
        subtitle={license.licenseNumber}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/dashboard/companies/${companyId}/licenses`)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              <ArrowRight size={14} className="rtl-flip" />
              رجوع
            </button>
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
            >
              <Pencil size={14} /> تعديل
            </button>
            <button
              onClick={() => { setDeleteError(""); setShowDelete(true); }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 size={14} /> حذف
            </button>
          </div>
        }
      />

      <div className="page-container space-y-6">

        {/* Parent license banner */}
        {license.mainLicense && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <Building2 size={16} className="shrink-0 text-blue-600" />
            <div className="flex-1 text-sm">
              <span className="text-blue-500">ترخيص فرعي من: </span>
              <button
                className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900"
                onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${license.mainLicense!.id}`)}
              >
                {license.mainLicense.commercialNameAr}
              </button>
              <span className="mr-2 font-mono text-xs text-blue-500">({license.mainLicense.licenseNumber})</span>
            </div>
          </div>
        )}

        {/* Info + expiry */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="section-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">معلومات الترخيص</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[license.status] ?? "bg-gray-100 text-gray-600"}`}>
                {STATUS_LABELS[license.status] ?? license.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <span className="text-muted-foreground">نوع الترخيص</span>
              <span className={`font-medium ${license.isMainLicense ? "text-green-700" : "text-blue-700"}`}>
                {license.isMainLicense ? "ترخيص رئيسي" : "ترخيص فرعي"}
              </span>
              {license.branch && (
                <>
                  <span className="text-muted-foreground">الفرع</span>
                  <span className="font-medium">{license.branch.nameAr}</span>
                </>
              )}
              {license.investor && (
                <>
                  <span className="text-muted-foreground">المستثمر</span>
                  <span className="font-medium">{license.investor.nameAr}</span>
                </>
              )}
              {license.issueDate && (
                <>
                  <span className="text-muted-foreground">تاريخ الإصدار</span>
                  <span>{new Date(license.issueDate).toLocaleDateString("ar-KW")}</span>
                </>
              )}
              {license.managerName && (
                <>
                  <span className="text-muted-foreground">المدير المسؤول</span>
                  <span>{license.managerName}</span>
                </>
              )}
              {license.managerPhone && (
                <>
                  <span className="text-muted-foreground">هاتف المدير</span>
                  <span className="font-mono text-xs" dir="ltr">{license.managerPhone}</span>
                </>
              )}
              {license.unifiedEntityNumber && (
                <>
                  <span className="text-muted-foreground">رقم الكيان الموحد</span>
                  <span className="font-mono text-xs" dir="ltr">{license.unifiedEntityNumber}</span>
                </>
              )}
              {license.civilEntityNumber && (
                <>
                  <span className="text-muted-foreground">رقم الكيان المدني</span>
                  <span className="font-mono text-xs" dir="ltr">{license.civilEntityNumber}</span>
                </>
              )}
              {license.fileNumber && (
                <>
                  <span className="text-muted-foreground">رقم الملف</span>
                  <span className="font-mono text-xs" dir="ltr">{license.fileNumber}</span>
                </>
              )}
            </div>
            {license.notes && (
              <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">{license.notes}</div>
            )}
          </div>

          <div className="section-card space-y-3">
            <h3 className="font-semibold">تواريخ الانتهاء</h3>
            {expDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">لم يتم تحديد تواريخ انتهاء</p>
            ) : (
              <div className="space-y-2">
                {expDates.map(({ label, date }) => (
                  <ExpiryBadge key={label} label={label} date={date} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sub-licenses */}
        {license.isMainLicense && (
          <div className="section-card space-y-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              <h3 className="font-semibold">التراخيص الفرعية ({license._count.branchLicenses})</h3>
            </div>
            {license.branchLicenses.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد تراخيص فرعية مرتبطة بهذا الترخيص</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th>الاسم التجاري</th>
                      <th>رقم الترخيص</th>
                      <th>الفرع</th>
                      <th>المستثمر</th>
                      <th className="text-center">موظفون</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {license.branchLicenses.map((sub) => (
                      <tr
                        key={sub.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${sub.id}`)}
                      >
                        <td className="font-medium text-blue-700">{sub.commercialNameAr}</td>
                        <td className="font-mono text-sm">{sub.licenseNumber}</td>
                        <td>{sub.branch?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                        <td>{sub.investor?.nameAr ?? <span className="text-muted-foreground">—</span>}</td>
                        <td className="text-center">{sub._count.employees}</td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[sub.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {STATUS_LABELS[sub.status] ?? sub.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Employees */}
        <div className="section-card space-y-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h3 className="font-semibold">الموظفون ({license._count.employees})</h3>
          </div>
          {license.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد موظفون مرتبطون بهذا الترخيص</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>النوع</th>
                    <th>حالة التوظيف</th>
                    <th>الجنسية</th>
                    <th>الرقم المدني</th>
                  </tr>
                </thead>
                <tbody>
                  {license.employees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => router.push(`/dashboard/companies/${companyId}/hr/employees/${emp.id}`)}
                    >
                      <td className="font-medium">{emp.nameAr}</td>
                      <td className="text-sm">{emp.type}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          emp.employmentStatus === "ACTIVE" ? "bg-green-100 text-green-700" :
                          emp.employmentStatus === "TERMINATED" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {emp.employmentStatus === "ACTIVE" ? "نشط" :
                           emp.employmentStatus === "TERMINATED" ? "منهي الخدمة" :
                           emp.employmentStatus === "ON_LEAVE" ? "إجازة" : emp.employmentStatus}
                        </span>
                      </td>
                      <td className="text-sm">{emp.nationality ?? "—"}</td>
                      <td className="font-mono text-xs" dir="ltr">{emp.civilId ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div className="section-card space-y-4">
          <div className="flex items-center gap-2">
            <Paperclip size={16} className="text-primary" />
            <h3 className="font-semibold">المرفقات ({attachments.length})</h3>
          </div>

          {uploadError && (
            <div className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{uploadError}</div>
          )}

          {/* hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />

          {/* زراير أنواع المرفقات */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {LICENSE_DOC_TYPES.map((docType) => {
              const count = attachments.filter((a) => a.documentCategory === docType.value).length;
              const isUploading = uploading && currentDocType === docType.value;
              return (
                <button
                  key={docType.value}
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setCurrentDocType(docType.value);
                    setTimeout(() => fileInputRef.current?.click(), 0);
                  }}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all
                    ${isUploading
                      ? "border-primary/50 bg-primary/5 opacity-70"
                      : "cursor-pointer border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5"
                    }`}
                >
                  {isUploading ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Upload size={20} className="text-muted-foreground" />
                  )}
                  <span className="text-xs leading-tight font-medium">{docType.label}</span>
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
              {LICENSE_DOC_TYPES.map((docType) => {
                const items = attachments.filter((a) => a.documentCategory === docType.value || (!a.documentCategory && docType.value === "LICENSE:OTHER"));
                if (items.length === 0) return null;
                return (
                  <div key={docType.value}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{docType.label}</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {items.map((att) => {
                        const isImage = att.mimeType?.startsWith("image/");
                        return (
                          <div key={att.id} className="group relative overflow-hidden rounded-xl border bg-muted/20">
                            {isImage ? (
                              <div className="aspect-video w-full overflow-hidden bg-muted">
                                <img src={att.filePath} alt={att.originalName} className="h-full w-full object-cover" />
                              </div>
                            ) : (
                              <div className="flex aspect-video items-center justify-center bg-muted/50">
                                <FileText size={36} className="text-muted-foreground" />
                              </div>
                            )}
                            <div className="p-2">
                              <p className="truncate text-xs font-medium">{att.originalName}</p>
                              <p className="text-[10px] text-muted-foreground">{formatBytes(att.fileSize)}</p>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                              <a href={att.filePath} target="_blank" rel="noopener noreferrer"
                                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:bg-gray-100">
                                عرض
                              </a>
                              <button onClick={() => setDeleteAttId(att.id)}
                                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
                                حذف
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <Modal title="تعديل الترخيص" wide onClose={() => setShowEdit(false)}>
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">البيانات الأساسية</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الاسم التجاري (عربي) *</label>
                  <input className="input-field" value={editForm.commercialNameAr} onChange={ef("commercialNameAr")} />
                </div>
                <div>
                  <label className="form-label">الاسم التجاري (إنجليزي)</label>
                  <input className="input-field" dir="ltr" value={editForm.commercialNameEn} onChange={ef("commercialNameEn")} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">رقم الترخيص *</label>
                  <input className="input-field" dir="ltr" value={editForm.licenseNumber} onChange={ef("licenseNumber")} />
                </div>
                <div>
                  <label className="form-label">الحالة</label>
                  <select className="input-field" value={editForm.status} onChange={ef("status")}>
                    <option value="ACTIVE">نشط</option>
                    <option value="INACTIVE">غير نشط</option>
                    <option value="EXPIRED">منتهي</option>
                    <option value="SUSPENDED">موقوف</option>
                    <option value="CANCELLED">ملغاة</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">رقم الملف</label>
                  <input className="input-field" dir="ltr" value={editForm.fileNumber} onChange={ef("fileNumber")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الفرع</label>
                  <select className="input-field" value={editForm.branchId} onChange={ef("branchId")}>
                    <option value="">— بدون فرع —</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">المستثمر</label>
                  <select className="input-field" value={editForm.investorId} onChange={ef("investorId")}>
                    <option value="">— بدون مستثمر —</option>
                    {investors.map((i) => (
                      <option key={i.id} value={i.id}>{i.nameAr}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">تاريخ الإصدار</label>
                  <input type="date" className="input-field" value={editForm.issueDate} onChange={ef("issueDate")} />
                </div>
                <div>
                  <label className="form-label">انتهاء الترخيص التجاري</label>
                  <input type="date" className="input-field" value={editForm.licenseExpiryDate} onChange={ef("licenseExpiryDate")} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">تواريخ انتهاء الرخص الأخرى</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">رخصة الإطفاء</label>
                  <input type="date" className="input-field" value={editForm.fireLicenseExpiryDate} onChange={ef("fireLicenseExpiryDate")} />
                </div>
                <div>
                  <label className="form-label">الترخيص الصحي</label>
                  <input type="date" className="input-field" value={editForm.healthLicenseExpiryDate} onChange={ef("healthLicenseExpiryDate")} />
                </div>
                <div>
                  <label className="form-label">رخصة الإعلانات</label>
                  <input type="date" className="input-field" value={editForm.advertisingLicenseExpiryDate} onChange={ef("advertisingLicenseExpiryDate")} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">المسؤول والأرقام الرسمية</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">اسم المدير</label>
                  <input className="input-field" value={editForm.managerName} onChange={ef("managerName")} />
                </div>
                <div>
                  <label className="form-label">هاتف المدير</label>
                  <input className="input-field" dir="ltr" value={editForm.managerPhone} onChange={ef("managerPhone")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">رقم الكيان الموحد</label>
                  <input className="input-field" dir="ltr" value={editForm.unifiedEntityNumber} onChange={ef("unifiedEntityNumber")} />
                </div>
                <div>
                  <label className="form-label">رقم الكيان المدني</label>
                  <input className="input-field" dir="ltr" value={editForm.civilEntityNumber} onChange={ef("civilEntityNumber")} />
                </div>
              </div>
            </div>

            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field" rows={2} value={editForm.notes} onChange={ef("notes")} />
            </div>

            {editError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{editError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowEdit(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">
                {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {showDelete && (
        <Modal title="تأكيد الحذف" onClose={() => setShowDelete(false)}>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-500" />
              <div>
                <p className="font-medium">هل تريد حذف هذا الترخيص؟</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  سيتم حذف <strong>{license.commercialNameAr}</strong> نهائياً. لا يمكن التراجع.
                </p>
              </div>
            </div>
            {deleteError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{deleteError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDelete(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={confirmDelete} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? "جاري الحذف..." : "حذف نهائي"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete attachment confirm */}
      {deleteAttId && (
        <Modal title="حذف المرفق" onClose={() => setDeleteAttId(null)}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-orange-500" />
            <p className="text-sm text-muted-foreground">هل تريد حذف هذا المرفق؟ لا يمكن التراجع.</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteAttId(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
            <button
              onClick={() => deleteAttachment(deleteAttId)}
              disabled={deletingAtt}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deletingAtt ? "جاري الحذف..." : "حذف"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
