"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight, FileText, Building2, Users, Car, Shield,
  Megaphone, Truck, Globe, UserCheck, FileCheck, BarChart3,
  Receipt, Pencil, Plus, Trash2, X, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Clock, Upload, ExternalLink,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { workInjuryDateStatus, workInjuryQuarterExpiryDate } from "@/lib/licenses/work-injury";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LicenseBase {
  id: string; commercialNameAr: string; licenseNumber: string;
  updatedAt: string | null;
  isMainLicense: boolean; status: string;
  branchId: string | null; investorId: string | null;
  legalEntity: string | null; capital: string | null; commercialRegNo: string | null;
  licenseExpiryDate: string | null; fireLicenseExpiryDate: string | null;
  healthLicenseExpiryDate: string | null;
  advertisingLicenseExpiryDate: string | null; trafficCertExpiryDate: string | null;
  customsCertExpiryDate: string | null; importLicenseExpiryDate: string | null;
  issueDate: string | null; unifiedEntityNumber: string | null;
  civilEntityNumber: string | null; fileNumber: string | null;
  managerName: string | null; managerCivilId: string | null; managerPhone: string | null;
  email: string | null; notes: string | null;
  branch: { nameAr: string } | null;
  investor: { nameAr: string } | null;
  mainLicense: { id: string; commercialNameAr: string; licenseNumber: string } | null;
  address: {
    automaticNumber: string | null; governorate: string | null; area: string | null;
    block: string | null; plot: string | null; street: string | null;
    buildingName: string | null; floor: string | null; unitType: string | null; unitNumber: string | null;
  } | null;
  branchLicenses: { id: string; commercialNameAr: string; licenseNumber: string; status: string }[];
  employees: { id: string; nameAr: string; employmentStatus: string }[];
  _count: { employees: number; branchLicenses: number };
}

interface Sections {
  establishmentContracts: {
    id: string; version: number; isActive: boolean; contractDate: string | null;
    notes: string | null; fileUrl: string | null;
    partners: { id: string; nameAr: string; nameEn: string | null; civilId: string | null; sharePercent: string; isDirector: boolean }[];
  }[];
  leaseContracts: {
    id: string; version: number; isActive: boolean; holderType: string;
    holderNameAr: string | null; startDate: string | null; endDate: string | null;
    monthlyRent: string | null; notes: string | null; fileUrl: string | null;
  }[];
  employerSignatureCert: {
    id: string; fileNumber: string | null; tradeName: string | null;
    companyCivilId: string | null; unifiedNumber: string | null;
    governorate: string | null; issueDate: string | null; expiryDate: string | null;
    fileUrl: string | null;
    signatories: { id: string; nameAr: string; nameEn: string | null }[];
  } | null;
  rentReceipts: { id: string; receiptDate: string | null; amount: string | null; fileUrl: string; notes: string | null }[];
  importLicenseDoc: { licenseNumber: string | null; startDate: string | null; endDate: string | null; fileUrl: string | null } | null;
  advertisingDetails: {
    adLicenseNumber: string | null; commercialLicenseNo: string | null;
    issueDate: string | null; expiryDate: string | null; commercialLicenseExpiry: string | null;
    municipalityAddress: string | null; district: string | null; street: string | null; block: string | null;
    fileUrl: string | null;
  } | null;
  fireSafetyCert: { licenseNumber: string | null; issueDate: string | null; expiryDate: string | null; fileUrl: string | null } | null;
  healthLicense: { licenseNumber: string | null; issuingAuthority: string | null; issueDate: string | null; expiryDate: string | null; inspectionDate: string | null; fileUrl: string | null; notes: string | null } | null;
  trafficCert: { issueDate: string | null; expiryDate: string | null; fileUrl: string | null } | null;
  customsCert: { issueDate: string | null; expiryDate: string | null; fileUrl: string | null } | null;
  licenseVehicles: { id: string; vehicleType: string; plateNumber: string; model: string | null; year: number | null; insuranceExpiry: string | null; licenseExpiry: string | null; notes: string | null }[];
  managerPOA: { principalName: string | null; agentName: string | null; issueDate: string | null; expiryDate: string | null; fileUrl: string | null; notes: string | null } | null;
  workInjuryInsurances: { id: string; year: number; quarter: number; policyNumber: string | null; certificateNo: string | null; startDate: string | null; endDate: string | null; fileUrl: string | null; createdAt: string; updatedAt: string }[];
  annualBalances: { id: string; year: number; accountant: string | null; fileUrl: string; notes: string | null }[];
  violations: { id: string; violationDate: string; violatorName: string; amount: string; fileUrl: string; notes: string | null; createdAt: string; updatedAt: string }[];
  partnerCivilIds: { id: string; partnerNameAr: string; civilId: string | null; expiryDate: string | null; fileUrl: string; createdAt: string; updatedAt: string }[];
}

interface AttachmentItem {
  id: string;
  filePath: string;
  originalName: string | null;
  documentCategory: string | null;
  createdAt: string;
}
interface DocumentVersion { id: string; sectionType: string; version: number; title: string | null; fileUrl: string | null; effectiveAt: string | null; createdAt: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(d: string | null | undefined): number | null {
  if (!d) return null;
  return Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
}

type CardStatus = "ok" | "warning" | "danger" | "empty";

function expiryStatus(d: string | null | undefined): CardStatus {
  if (!d) return "empty";
  const days = daysLeft(d);
  if (days === null) return "empty";
  if (days < 0) return "danger";
  if (days <= 60) return "warning";
  return "ok";
}

function statusBadge(s: CardStatus) {
  if (s === "ok")      return <CheckCircle size={15} className="text-green-500" />;
  if (s === "warning") return <Clock       size={15} className="text-yellow-500" />;
  if (s === "danger")  return <AlertTriangle size={15} className="text-red-500" />;
  return <Plus size={15} className="text-muted-foreground" />;
}

function statusRing(s: CardStatus) {
  if (s === "ok")      return "border-green-200  bg-green-50/40";
  if (s === "warning") return "border-yellow-200 bg-yellow-50/40";
  if (s === "danger")  return "border-red-200    bg-red-50/40";
  return "border-border bg-muted/20";
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-KW");
}

function recordUpdatedAt(record: unknown): string | null {
  if (!record || typeof record !== "object") return null;
  const item = record as { updatedAt?: string | null; createdAt?: string | null };
  return item.updatedAt ?? item.createdAt ?? null;
}

function fmtDays(d: string | null | undefined) {
  const n = daysLeft(d);
  if (n === null) return null;
  if (n < 0) return <span className="text-red-600 text-xs font-medium">منتهي منذ {Math.abs(n)} يوم</span>;
  if (n <= 60) return <span className="text-yellow-600 text-xs font-medium">ينتهي خلال {n} يوم</span>;
  return null;
}

function FileLink({ url, label = "عرض الملف", onDelete }: { url: string | null | undefined; label?: string; onDelete?: () => void }) {
  if (!url) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
        <ExternalLink size={11} /> {label}
      </a>
      {onDelete && <button type="button" onClick={onDelete} className="text-red-400 hover:text-red-600" title="حذف الملف"><Trash2 size={12} /></button>}
    </span>
  );
}

function VersionHistory({ versions, sectionType, onDeleteVersion }: { versions: DocumentVersion[]; sectionType: string; onDeleteVersion?: (versionId: string) => void }) {
  const entries = versions.filter((entry) => entry.sectionType === sectionType);
  if (!entries.length) return null;
  return <div className="mt-2 space-y-1 border-t pt-2"><p className="text-xs font-medium text-muted-foreground">سجل الإصدارات</p>{entries.map((entry) => <div key={entry.id} className="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs"><span>نسخة {entry.version} · {fmt(entry.effectiveAt ?? entry.createdAt)}</span><FileLink url={entry.fileUrl} label="عرض" onDelete={onDeleteVersion ? () => onDeleteVersion(entry.id) : undefined} /></div>)}</div>;
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon, title, status, subtitle, children, onEdit, editLabel, onDelete, fileUrl, lastUpdatedAt,
}: {
  icon: React.ElementType; title: string; status: CardStatus;
  subtitle?: string; children?: React.ReactNode;
  onEdit?: () => void; editLabel?: string;
  onDelete?: () => void;
  fileUrl?: string | null; lastUpdatedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-xl border-2 transition-all ${statusRing(status)}`}>
      <div className="flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex flex-1 items-center gap-3 p-4 text-right"
      >
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          status === "ok" ? "bg-green-100" : status === "warning" ? "bg-yellow-100" :
          status === "danger" ? "bg-red-100" : "bg-muted"
        }`}>
          <Icon size={16} className={
            status === "ok" ? "text-green-600" : status === "warning" ? "text-yellow-600" :
            status === "danger" ? "text-red-600" : "text-muted-foreground"
          } />
        </div>
        <div className="flex-1 text-right">
          <p className="font-medium text-sm">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          {lastUpdatedAt && <p className="text-xs text-muted-foreground mt-0.5">آخر تعديل: {fmt(lastUpdatedAt)}</p>}
        </div>
        {statusBadge(status)}
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {fileUrl && (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer" title="عرض الملف"
          className="ml-3 inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-primary hover:bg-muted">
          <ExternalLink size={12} /> عرض
        </a>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} title="حذف البيانات والملف"
          className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50">
          <Trash2 size={12} /> حذف
        </button>
      )}
      </div>

      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {children}
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Pencil size={12} /> {editLabel ?? "تعديل"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modal Wrapper ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-xl bg-card shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b bg-card px-5 py-4">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── File Upload Field ─────────────────────────────────────────────────────────

function FileUploadField({
  value, onChange, licenseId, label = "الملف", required, documentCategory, onUploaded,
}: {
  value: string;
  onChange: (url: string) => void;
  licenseId: string;
  label?: string;
  required?: boolean;
  documentCategory?: string;
  onUploaded?: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
      setUploadErr(""); setUploadNotice(""); setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (documentCategory) fd.append("documentCategory", documentCategory);
      const res = await fetch(`/api/licenses/${licenseId}/attachments`, { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onChange(json.data.filePath);
        onUploaded?.(json.data.filePath);
      setUploadNotice("تم رفع الملف. اضغط حفظ لتسجيل بيانات هذا القسم.");
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 mr-1">*</span>}
      </label>
      <input
        ref={fileRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xlsx,.xls"
        onChange={handleFile}
      />
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50 shrink-0"
        >
          {uploading
            ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent inline-block" />
            : <Upload size={13} />
          }
          {uploading ? "جاري الرفع..." : value ? "استبدال الملف" : "رفع ملف"}
        </button>
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink size={12} /> عرض الملف الحالي
          </a>
        )}
      </div>
      {uploadErr && (
        <p className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{uploadErr}</p>
      )}
      {uploadNotice && <p className="mt-1 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">{uploadNotice}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LicenseDetailPage() {
  const { companyId, licenseId } = useParams<{ companyId: string; licenseId: string }>();
  const router = useRouter();

  const [license, setLicense] = useState<LicenseBase | null>(null);
  const [sections, setSections] = useState<Sections | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [documentVersions, setDocumentVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRequestRef = useRef(0);
  const [error, setError] = useState("");
  const [investors, setInvestors] = useState<{ id: string; nameAr: string }[]>([]);
  const [mainLicenses, setMainLicenses] = useState<{ id: string; commercialNameAr: string; licenseNumber: string }[]>([]);

  // Active modal
  type ModalType = "basic_info" | "establishment" | "lease" | "employer_cert" | "import_license" |
    "advertising" | "fire_safety" | "health_license" | "traffic_cert" | "customs_cert" |
    "vehicle_add" | "vehicle_edit" | "manager_poa" | "work_injury" |
    "annual_balance" | "rent_receipt" | "violation" | "partner_civil_id" | null;
  const [modal, setModal] = useState<ModalType>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [sectionsError, setSectionsError] = useState("");
  const [editTarget, setEditTarget] = useState<string | null>(null); // vehicleId etc.

  // Generic form state
  const [form, setForm] = useState<Record<string, unknown>>({});

  const attachmentCategoryByModal: Partial<Record<Exclude<ModalType, null>, string>> = {
    establishment: "ESTABLISHMENT_CONTRACT", lease: "LEASE_CONTRACT", employer_cert: "EMPLOYER_SIGNATURE_CERT",
    rent_receipt: "RENT_RECEIPT", import_license: "IMPORT_LICENSE", advertising: "ADVERTISING_LICENSE",
    fire_safety: "FIRE_SAFETY_CERT", health_license: "HEALTH_LICENSE", traffic_cert: "TRAFFIC_CERT",
    customs_cert: "CUSTOMS_CERT", manager_poa: "MANAGER_POA", work_injury: "WORK_INJURY", annual_balance: "ANNUAL_BALANCE",
    violation: "LICENSE_VIOLATION", partner_civil_id: "PARTNER_CIVIL_ID",
  };

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    const [licRes, secRes, attRes, versionsRes] = await Promise.all([
      fetch(`/api/licenses/${licenseId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/licenses/${licenseId}/sections`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/licenses/${licenseId}/attachments`).then((r) => r.json()).catch(() => null),
      fetch(`/api/licenses/${licenseId}/document-versions`).then((r) => r.json()).catch(() => null),
    ]);
    if (requestId !== loadRequestRef.current) return;
    if (licRes?.success) setLicense(licRes.data);
    else setError(licRes?.error ?? "فشل في جلب بيانات الترخيص");
    if (secRes?.success) {
      setSections(secRes.data);
      setSectionsError("");
    } else {
      setSections(null);
      setSectionsError(secRes?.error ?? "تعذر تحميل بيانات بطاقات الترخيص. أعد المحاولة.");
    }
    if (attRes?.success) setAttachments(attRes.data);
    if (versionsRes?.success) setDocumentVersions(versionsRes.data);
    setLoading(false);
  }, [licenseId]);

  // جلب الفروع والمستثمرين مرة واحدة
  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      fetch(`/api/investors?companyId=${companyId}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/licenses?companyId=${companyId}`).then((r) => r.json()).catch(() => null),
    ]).then(([i, l]) => {
      if (i?.success) setInvestors(i.data);
      if (l?.success) setMainLicenses((l.data as LicenseBase[]).filter((item) => item.isMainLicense).map((item) => ({
        id: item.id,
        commercialNameAr: item.commercialNameAr,
        licenseNumber: item.licenseNumber,
      })));
    });
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  function openModal(type: ModalType, initialForm: Record<string, unknown> = {}, targetId: string | null = null) {
    const category = type ? attachmentCategoryByModal[type] : undefined;
    const uploadedFile = category ? attachments.find((attachment) => attachment.documentCategory === category)?.filePath : undefined;
    setModal(type);
    setForm({ ...initialForm, fileUrl: initialForm.fileUrl || uploadedFile || "" });
    setSaveError("");
    setEditTarget(targetId);
  }

  function f(key: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));
  }

  function updatePartner(index: number, field: "nameAr" | "civilId" | "sharePercent" | "isDirector", value: string | boolean) {
    setForm((current) => {
      const partners = [...((current.partners as Record<string, unknown>[] | undefined) ?? [])];
      partners[index] = { ...partners[index], [field]: value };
      return { ...current, partners };
    });
  }

  function setFileUrl(url: string) {
    setForm((p) => ({ ...p, fileUrl: url }));
  }

  async function save(url: string, method: string, body: Record<string, unknown>) {
    setSaving(true); setSaveError("");
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { setSaveError(data.error ?? "فشل الحفظ"); return false; }
      await load();
      setModal(null);
      return true;
    } catch { setSaveError("حدث خطأ في الاتصال"); return false; }
    finally { setSaving(false); }
  }

  // ── Section Savers ─────────────────────────────────────────────────────────

  async function saveBasicInfo() {
    await save(`/api/licenses/${licenseId}`, "PATCH", {
      mainLicenseId:    license?.isMainLicense ? undefined : (form.mainLicenseId || null),
      investorId:       form.investorId || null,
      commercialNameAr: form.commercialNameAr || undefined,
      commercialNameEn: form.commercialNameEn || null,
      licenseNumber:    form.licenseNumber    || undefined,
      status:           form.status           || undefined,
      issueDate:        form.issueDate        || null,
      licenseExpiryDate: form.licenseExpiryDate || null,
      commercialRegNo:  form.commercialRegNo  || null,
      unifiedEntityNumber: form.unifiedEntityNumber || null,
      civilEntityNumber:   form.civilEntityNumber   || null,
      fileNumber:          form.fileNumber          || null,
      legalEntity:         form.legalEntity         || null,
      capital:             form.capital ? Number(form.capital) : null,
      managerName:         form.managerName         || null,
      managerCivilId:      form.managerCivilId      || null,
      managerPhone:        form.managerPhone        || null,
      email:               form.email               || null,
      address: {
        automaticNumber: form.automaticNumber || null,
        governorate:     form.governorate     || null,
        area:            form.area            || null,
        block:           form.block           || null,
        street:          form.street          || null,
        plot:            form.plot            || null,
        unitNumber:      form.unitNumber      || null,
      },
      notes:               form.notes               || null,
    });
  }

  async function saveSection(sectionType: string) {
    await save(`/api/licenses/${licenseId}/section`, "PUT", { sectionType, ...form });
  }

  async function saveEstContract() {
    const partners = (form.partners as { nameAr: string; sharePercent: string; isDirector: boolean }[] | undefined) ?? [];
    for (const p of partners) {
      const sp = Number(p.sharePercent);
      if (isNaN(sp) || sp < 0 || sp > 100) {
        setSaveError(`نسبة الشريك "${p.nameAr || "؟"}" يجب أن تكون بين 0 و 100`);
        return;
      }
    }
    await save(`/api/licenses/${licenseId}/establishment-contract`, "POST", {
      contractDate: form.contractDate, notes: form.notes, fileUrl: form.fileUrl, partners,
    });
  }

  async function saveLeaseContract() {
    await save(`/api/licenses/${licenseId}/lease-contract`, "POST", form);
  }

  async function saveVehicle() {
    if (editTarget) {
      await save(`/api/licenses/${licenseId}/vehicles/${editTarget}`, "PATCH", form);
    } else {
      await save(`/api/licenses/${licenseId}/vehicles`, "POST", form);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!confirm("تأكيد حذف المركبة؟")) return;
    await save(`/api/licenses/${licenseId}/vehicles/${vehicleId}`, "DELETE", {});
  }

  async function deleteEstablishmentContract(contractId: string) {
    if (!confirm("تأكيد حذف نسخة عقد التأسيس؟ سيُعتمد أحدث إصدار متبقٍ تلقائيًا.")) return;
    await save(`/api/licenses/${licenseId}/establishment-contract?contractId=${contractId}`, "DELETE", {});
  }

  async function saveWorkInjury() {
    const year = Number(form.year);
    const quarter = Number(form.quarter);
    if (!year || ![1, 2, 3, 4].includes(quarter)) {
      setSaveError("\u064a\u062c\u0628 \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0633\u0646\u0629 \u0648\u0627\u0644\u0631\u0628\u0639 \u0642\u0628\u0644 \u062d\u0641\u0638 \u0648\u062b\u064a\u0642\u0629 \u0627\u0644\u062a\u0623\u0645\u064a\u0646.");
      return;
    }
    await save(`/api/licenses/${licenseId}/work-injury`, "PUT", form);
  }

  async function saveWorkInjuryFile(fileUrl: string) {
    // The uploaded document is the primary record for this section. Persist it
    // immediately so it cannot become an orphaned attachment when the modal closes.
    const year = Number(form.year) || new Date().getFullYear();
    const quarter = Number(form.quarter) || Math.floor(new Date().getMonth() / 3) + 1;
    await save(`/api/licenses/${licenseId}/work-injury`, "PUT", {
      ...form,
      year,
      quarter,
      fileUrl,
    });
  }

  async function saveAnnualBalance() {
    if (editTarget) {
      await save(`/api/licenses/${licenseId}/annual-balance/${editTarget}`, "PATCH", form);
    } else {
      await save(`/api/licenses/${licenseId}/annual-balance`, "POST", form);
    }
  }

  async function deleteAnnualBalance(balanceId: string) {
    if (!confirm("تأكيد حذف الميزانية؟")) return;
    await save(`/api/licenses/${licenseId}/annual-balance/${balanceId}`, "DELETE", {});
  }

  async function saveRentReceipt() {
    if (editTarget) {
      await save(`/api/licenses/${licenseId}/rent-receipts/${editTarget}`, "PATCH", form);
    } else {
      await save(`/api/licenses/${licenseId}/rent-receipts`, "POST", form);
    }
  }

  async function deleteRentReceipt(receiptId: string) {
    if (!confirm("تأكيد حذف الإيصال؟")) return;
    await save(`/api/licenses/${licenseId}/rent-receipts/${receiptId}`, "DELETE", {});
  }

  async function saveViolation() {
    if (editTarget) await save(`/api/licenses/${licenseId}/violations/${editTarget}`, "PATCH", form);
    else await save(`/api/licenses/${licenseId}/violations`, "POST", form);
  }

  async function deleteViolation(violationId: string) {
    if (!confirm("تأكيد حذف المخالفة؟")) return;
    await save(`/api/licenses/${licenseId}/violations/${violationId}`, "DELETE", {});
  }

  async function savePartnerCivilId() {
    if (editTarget) await save(`/api/licenses/${licenseId}/partner-civil-ids/${editTarget}`, "PATCH", form);
    else await save(`/api/licenses/${licenseId}/partner-civil-ids`, "POST", form);
  }

  async function deletePartnerCivilId(civilIdId: string) {
    if (!confirm("تأكيد حذف بطاقة الشريك؟")) return;
    await save(`/api/licenses/${licenseId}/partner-civil-ids/${civilIdId}`, "DELETE", {});
  }

  async function deleteSimpleSection(sectionType: string, label: string) {
    if (!confirm(`تأكيد حذف ${label} مع الملف وسجل الإصدارات؟`)) return;
    await save(`/api/licenses/${licenseId}/section?sectionType=${sectionType}`, "DELETE", {});
  }

  async function deleteAttachment(attachmentId: string) {
    if (!confirm("تأكيد حذف هذا الملف المرفوع؟")) return;
    await save(`/api/licenses/${licenseId}/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, "DELETE", {});
  }

  async function deleteDocumentVersion(versionId: string) {
    if (!confirm("تأكيد حذف هذا الإصدار والملف المرتبط به؟")) return;
    await save(`/api/licenses/${licenseId}/document-versions?versionId=${encodeURIComponent(versionId)}`, "DELETE", {});
  }

  async function deleteWorkInjury(year: number, quarter: number) {
    if (!confirm("تأكيد حذف وثيقة التأمين؟")) return;
    await save(`/api/licenses/${licenseId}/work-injury?year=${year}&quarter=${quarter}`, "DELETE", {});
  }

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading) return (
    <div>
      <Header title="تفاصيل الترخيص" companyId={companyId} />
      <div className="py-20 text-center text-sm text-muted-foreground">جاري التحميل...</div>
    </div>
  );

  if (error || !license) return (
    <div>
      <Header title="تفاصيل الترخيص" companyId={companyId} />
      <div className="page-container"><div className="section-card text-center text-red-600">{error || "الترخيص غير موجود"}</div></div>
    </div>
  );

  const s = sections;
    const activeEstContract = s?.establishmentContracts.find((c) => c.isActive) ?? s?.establishmentContracts[0];
    const partnerContract = s?.establishmentContracts.find((c) => c.partners.length > 0);
    const displayedPartners = activeEstContract?.partners.length
      ? activeEstContract.partners
    : partnerContract?.partners ?? [];
  const activeLeaseContract = s?.leaseContracts.find((c) => c.isActive);
  const establishmentAttachment = attachments.find((attachment) => attachment.documentCategory === "ESTABLISHMENT_CONTRACT");
  const leaseAttachment = attachments.find((attachment) => attachment.documentCategory === "LEASE_CONTRACT");
  const employerSignatureAttachment = attachments.find((attachment) => attachment.documentCategory === "EMPLOYER_SIGNATURE_CERT");
  const rentReceiptAttachment = attachments.find((attachment) => attachment.documentCategory === "RENT_RECEIPT");
  const annualBalanceAttachment = attachments.find((attachment) => attachment.documentCategory === "ANNUAL_BALANCE");
  const commercialLicenseAttachment = attachments.find((attachment) => attachment.documentCategory === "COMMERCIAL_LICENSE");
  const latestAttachment = (...categories: string[]) => attachments.find((attachment) => categories.includes(attachment.documentCategory ?? ""));
  const latestVersion = (sectionType: string) => documentVersions
    .filter((entry) => entry.sectionType === sectionType)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const documentFile = (sectionType: string, fallback?: string | null, attachmentCategory?: string) =>
    latestVersion(sectionType)?.fileUrl ?? fallback ?? (attachmentCategory ? latestAttachment(attachmentCategory)?.filePath : null) ?? null;
  const documentUpdatedAt = (sectionType: string, fallback?: string | null, attachmentCategory?: string) =>
    latestVersion(sectionType)?.createdAt ?? fallback ?? (attachmentCategory ? latestAttachment(attachmentCategory)?.createdAt : null) ?? null;
  // A section can have an uploaded version or attachment before its structured record exists.
  // Keep the delete action available in both cases so the card never leaves orphaned files behind.
  const hasStoredSection = (sectionType: string, record?: unknown, attachmentCategory?: string, fallbackData?: unknown) =>
    Boolean(record || fallbackData || latestVersion(sectionType) || (attachmentCategory && latestAttachment(attachmentCategory)));
  const isMainLicense = license.isMainLicense;
  const latestWorkInjury = s?.workInjuryInsurances[0] ?? null;
  const latestWorkInjuryQuarterExpiry = latestWorkInjury
    ? workInjuryQuarterExpiryDate(latestWorkInjury.year, latestWorkInjury.quarter)
    : null;
  const workInjuryStatus = latestWorkInjury
    ? [workInjuryDateStatus(latestWorkInjuryQuarterExpiry), workInjuryDateStatus(latestWorkInjury.endDate)].includes("danger")
      ? "danger"
      : [workInjuryDateStatus(latestWorkInjuryQuarterExpiry), workInjuryDateStatus(latestWorkInjury.endDate)].includes("warning")
        ? "warning"
        : "ok"
    : "empty";

  // Card statuses
  const statusMap: Record<string, CardStatus> = {
    establishment: activeEstContract ? "ok" : establishmentAttachment ? "warning" : "empty",
    lease:         activeLeaseContract ? "ok" : leaseAttachment ? "warning" : "empty",
    employer_cert: s?.employerSignatureCert ? expiryStatus(s.employerSignatureCert.expiryDate) === "empty" ? "ok" : expiryStatus(s.employerSignatureCert.expiryDate) : employerSignatureAttachment ? "warning" : "empty",
    rent_receipts: (s?.rentReceipts.length ?? 0) > 0 ? "ok" : rentReceiptAttachment ? "warning" : "empty",
    import_license: s?.importLicenseDoc ? expiryStatus(s.importLicenseDoc.endDate) : "empty",
    advertising:   expiryStatus(license.advertisingLicenseExpiryDate),
    fire_safety:   expiryStatus(license.fireLicenseExpiryDate),
    health_license: expiryStatus(license.healthLicenseExpiryDate),
    traffic_cert:  expiryStatus(license.trafficCertExpiryDate),
    customs_cert:  expiryStatus(license.customsCertExpiryDate),
    vehicles:      (s?.licenseVehicles.length ?? 0) > 0 ? "ok" : "empty",
    manager_poa:   s?.managerPOA ? "ok" : "empty",
    work_injury:   workInjuryStatus,
    annual_balance:(s?.annualBalances.length ?? 0) > 0 ? "ok" : annualBalanceAttachment ? "warning" : "empty",
    violations:    (s?.violations.length ?? 0) > 0 ? "warning" : "empty",
    partner_civil_ids: (s?.partnerCivilIds.length ?? 0) > 0 ? "ok" : "empty",
  };

  const HOLDER_LABELS: Record<string, string> = { INVESTOR: "المسئول والمدير", GROUP_OWNER: "صاحب المجموعة", OTHER_KUWAITI: "كويتي آخر" };
  const QUARTER_LABELS = ["", "الأول (يناير–مارس)", "الثاني (أبريل–يونيو)", "الثالث (يوليو–سبتمبر)", "الرابع (أكتوبر–ديسمبر)"];
  const STATUS_COLORS: Record<string, string> = { ACTIVE: "bg-emerald-100 text-emerald-700", EXPIRED: "bg-red-100 text-red-700", SUSPENDED: "bg-orange-100 text-orange-700", CANCELLED: "bg-rose-100 text-rose-700" };
  const STATUS_LABELS: Record<string, string> = { ACTIVE: "فعال", EXPIRED: "منتهي", SUSPENDED: "موقوف", CANCELLED: "ملغاة" };

  return (
    <div>
      <Header
        title={license.commercialNameAr}
        subtitle={`${license.isMainLicense ? "رئيسي" : "فرعي"} · ${license.licenseNumber}`}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/dashboard/companies/${companyId}/licenses`)}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              <ArrowRight size={14} className="rtl-flip" /> رجوع
            </button>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[license.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[license.status] ?? license.status}
            </span>
          </div>
        }
      />

      <div className="page-container space-y-6">

        {sectionsError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {sectionsError}
          </div>
        )}

        {/* Parent banner */}
        {license.mainLicense && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
            <Building2 size={15} className="text-blue-500 shrink-0" />
            <span className="text-blue-500">فرع من: </span>
            <button className="font-semibold text-blue-700 hover:underline"
              onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${license.mainLicense!.id}`)}>
              {license.mainLicense.commercialNameAr}
            </button>
          </div>
        )}

        {/* Basic info */}
        <div className="section-card grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          {license.investor && <><span className="text-muted-foreground">المسئول والمدير</span><span className="font-medium">{license.investor.nameAr}</span></>}
          {license.managerName && <><span className="text-muted-foreground">اسم المدير</span><span className="font-medium">{license.managerName}</span></>}
          {license.managerPhone && <><span className="text-muted-foreground">هاتف المدير</span><span dir="ltr">{license.managerPhone}</span></>}
          {displayedPartners.length ? <><span className="text-muted-foreground">الشركاء</span><span className="font-medium">{displayedPartners.map((partner) => `${partner.nameAr}${partner.isDirector ? " (مدير)" : ""}`).join("، ")}</span></> : null}
          {license.licenseExpiryDate && <><span className="text-muted-foreground">انتهاء الترخيص</span><span className={`font-medium ${expiryStatus(license.licenseExpiryDate) === "danger" ? "text-red-600" : expiryStatus(license.licenseExpiryDate) === "warning" ? "text-yellow-600" : ""}`}>{fmt(license.licenseExpiryDate)}</span></>}
          {license.unifiedEntityNumber && <><span className="text-muted-foreground">الرقم الموحد</span><span dir="ltr" className="font-mono text-xs">{license.unifiedEntityNumber}</span></>}
          {license.civilEntityNumber && <><span className="text-muted-foreground">رقم الجهة المدني</span><span dir="ltr" className="font-mono text-xs">{license.civilEntityNumber}</span></>}
          {license.legalEntity && <><span className="text-muted-foreground">الكيان القانوني</span><span>{license.legalEntity === "LLC" ? "ذات مسئولية محدودة" : license.legalEntity === "PARTNERSHIP" ? "تضامنية" : license.legalEntity === "JOINT_STOCK" ? "مساهمة" : license.legalEntity}</span></>}
          {license.capital && <><span className="text-muted-foreground">رأس المال</span><span dir="ltr" className="number">{Number(license.capital).toFixed(3)} د.ك</span></>}
        </div>

        {/* 14 section cards — 2 columns on md+ */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

          {/* [1] عقد التأسيس */}
          {isMainLicense && (
          <SectionCard icon={FileText} title="عقد التأسيس" status={statusMap.establishment}
            fileUrl={activeEstContract?.fileUrl ?? establishmentAttachment?.filePath} lastUpdatedAt={establishmentAttachment?.createdAt}
            onDelete={hasStoredSection("establishment", activeEstContract, "ESTABLISHMENT_CONTRACT") ? () => deleteSimpleSection("establishment", "عقد التأسيس") : undefined}
            subtitle={activeEstContract
              ? `نسخة ${activeEstContract.version} · ${displayedPartners.length ? `الشركاء: ${displayedPartners.map((partner) => partner.nameAr).join("، ")}` : fmt(activeEstContract.contractDate)}`
              : establishmentAttachment ? "مرفق مرفوع — استكمل الحفظ" : "لم يُدخل بعد"}
            onEdit={() => openModal("establishment", {
              contractDate: activeEstContract?.contractDate?.slice(0, 10) ?? "",
              notes: activeEstContract?.notes ?? "",
              fileUrl: activeEstContract?.fileUrl ?? establishmentAttachment?.filePath ?? "",
              partners: activeEstContract?.partners.map((p) => ({ nameAr: p.nameAr, nameEn: p.nameEn ?? "", civilId: p.civilId ?? "", sharePercent: p.sharePercent, isDirector: p.isDirector })) ?? [],
            })} editLabel={activeEstContract ? "إضافة تعديل جديد" : "إدخال العقد"}
          >
            {activeEstContract && (
              <div className="space-y-2">
                {displayedPartners.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <span className="font-medium">{p.nameAr}</span>
                    <span className="text-muted-foreground">{Number(p.sharePercent)}%{p.isDirector ? " · مدير" : ""}</span>
                  </div>
                ))}
                <div className="border-t pt-2 text-xs font-medium">سجل النسخ والمرفقات</div>
                {s!.establishmentContracts.map((contract) => (
                  <div key={contract.id} className="flex items-center justify-between rounded-lg border bg-background/60 px-2 py-1.5 text-xs">
                    <span>نسخة {contract.version}{contract.isActive ? " · الحالية" : " · مؤرشفة"} · {fmt(contract.contractDate)}</span>
                    <div className="flex items-center gap-3">
                      <FileLink url={contract.fileUrl} label="عرض المرفق" onDelete={() => deleteEstablishmentContract(contract.id)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!activeEstContract && establishmentAttachment && <FileLink url={establishmentAttachment.filePath} label="عرض الملف المرفوع" onDelete={() => deleteAttachment(establishmentAttachment.id)} />}
          </SectionCard>

          )}

          {isMainLicense && (
          <SectionCard icon={Users} title="مدنيات الشركاء" status={statusMap.partner_civil_ids}
            fileUrl={s?.partnerCivilIds[0]?.fileUrl} lastUpdatedAt={s?.partnerCivilIds[0]?.updatedAt}
            subtitle={`${s?.partnerCivilIds.length ?? 0} بطاقة شريك`}
            onEdit={() => openModal("partner_civil_id", { partnerNameAr: displayedPartners[0]?.nameAr ?? "", civilId: displayedPartners[0]?.civilId ?? "", expiryDate: "", fileUrl: "" })}
            editLabel="إضافة بطاقة شريك"
          >
            {(s?.partnerCivilIds.length ?? 0) > 0 && <div className="space-y-1">
              {s!.partnerCivilIds.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <div><span className="font-medium">{item.partnerNameAr}</span><span className="mr-2 text-muted-foreground">ينتهي: {fmt(item.expiryDate)}</span></div>
                <div className="flex items-center gap-2"><FileLink url={item.fileUrl} label="عرض البطاقة" /><button onClick={() => openModal("partner_civil_id", { partnerNameAr: item.partnerNameAr, civilId: item.civilId ?? "", expiryDate: item.expiryDate?.slice(0, 10) ?? "", fileUrl: item.fileUrl }, item.id)} className="text-primary" title="تعديل"><Pencil size={12} /></button><button onClick={() => deletePartnerCivilId(item.id)} className="text-red-400 hover:text-red-600" title="حذف"><Trash2 size={12} /></button></div>
              </div>)}
            </div>}
          </SectionCard>
          )}

          <SectionCard icon={AlertTriangle} title="مخالفات التراخيص" status={statusMap.violations}
            fileUrl={s?.violations[0]?.fileUrl} lastUpdatedAt={s?.violations[0]?.updatedAt}
            subtitle={`${s?.violations.length ?? 0} مخالفة مُسجلة`}
            onEdit={() => openModal("violation", { violationDate: "", violatorName: "", amount: "", fileUrl: "", notes: "" })}
            editLabel="إضافة مخالفة"
          >
            {(s?.violations.length ?? 0) > 0 && <div className="space-y-1">
              {s!.violations.map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <div><span className="font-medium">{item.violatorName}</span><span className="mr-2 text-muted-foreground">{fmt(item.violationDate)} · {Number(item.amount).toFixed(3)} د.ك</span></div>
                <div className="flex items-center gap-2"><FileLink url={item.fileUrl} label="عرض المخالفة" /><button onClick={() => openModal("violation", { violationDate: item.violationDate.slice(0, 10), violatorName: item.violatorName, amount: item.amount, fileUrl: item.fileUrl, notes: item.notes ?? "" }, item.id)} className="text-primary" title="تعديل"><Pencil size={12} /></button><button onClick={() => deleteViolation(item.id)} className="text-red-400 hover:text-red-600" title="حذف"><Trash2 size={12} /></button></div>
              </div>)}
            </div>}
          </SectionCard>

          {/* [2] عقد الإيجار */}
          <SectionCard icon={Building2} title="عقد الإيجار" status={statusMap.lease}
            fileUrl={activeLeaseContract?.fileUrl ?? leaseAttachment?.filePath} lastUpdatedAt={recordUpdatedAt(activeLeaseContract) ?? leaseAttachment?.createdAt ?? null}
            onDelete={hasStoredSection("lease", activeLeaseContract, "LEASE_CONTRACT") ? () => deleteSimpleSection("lease", "عقد الإيجار") : undefined}
            subtitle={activeLeaseContract ? `${HOLDER_LABELS[activeLeaseContract.holderType] ?? activeLeaseContract.holderType} · ${fmt(activeLeaseContract.endDate)}` : leaseAttachment ? "مرفق مرفوع — استكمل الحفظ" : "لم يُدخل بعد"}
            onEdit={() => openModal("lease", {
              holderType: activeLeaseContract?.holderType ?? "INVESTOR",
              holderNameAr: activeLeaseContract?.holderNameAr ?? "",
              startDate: activeLeaseContract?.startDate?.slice(0, 10) ?? "",
              endDate: activeLeaseContract?.endDate?.slice(0, 10) ?? "",
              monthlyRent: activeLeaseContract?.monthlyRent ?? "",
              notes: activeLeaseContract?.notes ?? "",
              fileUrl: activeLeaseContract?.fileUrl ?? leaseAttachment?.filePath ?? "",
            })} editLabel={activeLeaseContract ? "إضافة تعديل جديد" : "إدخال العقد"}
          >
            {activeLeaseContract && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">الإيجار على</span><span>{HOLDER_LABELS[activeLeaseContract.holderType] ?? activeLeaseContract.holderType}{activeLeaseContract.holderNameAr ? ` — ${activeLeaseContract.holderNameAr}` : ""}</span>
                  {activeLeaseContract.startDate && <><span className="text-muted-foreground">من</span><span>{fmt(activeLeaseContract.startDate)}</span></>}
                  {activeLeaseContract.endDate && <><span className="text-muted-foreground">إلى</span><span>{fmt(activeLeaseContract.endDate)}</span></>}
                  {activeLeaseContract.monthlyRent && <><span className="text-muted-foreground">الإيجار الشهري</span><span dir="ltr">{Number(activeLeaseContract.monthlyRent).toFixed(3)} د.ك</span></>}
                </div>
                <FileLink url={activeLeaseContract.fileUrl} label="عرض العقد" onDelete={() => deleteSimpleSection("lease", "عقد الإيجار")} />
              </div>
            )}
            {!activeLeaseContract && leaseAttachment && <FileLink url={leaseAttachment.filePath} label="عرض الملف المرفوع" onDelete={() => deleteAttachment(leaseAttachment.id)} />}
          </SectionCard>

          {/* [3] الترخيص التجاري — handled via basic license PATCH */}
          <SectionCard icon={FileCheck} title="الترخيص التجاري" status={expiryStatus(license.licenseExpiryDate)}
            fileUrl={commercialLicenseAttachment?.filePath} lastUpdatedAt={commercialLicenseAttachment?.createdAt ?? license.updatedAt ?? null}
            onDelete={hasStoredSection("commercial_license", undefined, "COMMERCIAL_LICENSE", license.licenseExpiryDate ?? license.issueDate ?? license.commercialRegNo) ? () => deleteSimpleSection("commercial_license", "بيانات وملف الترخيص التجاري") : undefined}
            subtitle={license.licenseExpiryDate ? `ينتهي ${fmt(license.licenseExpiryDate)}` : "لم يُدخل تاريخ الانتهاء"}
            onEdit={() => openModal("basic_info", {
              mainLicenseId:         license.mainLicense?.id ?? "",
              investorId:          license.investorId ?? "",
              commercialNameAr:    license.commercialNameAr,
              licenseNumber:       license.licenseNumber,
              status:              license.status,
              issueDate:           license.issueDate?.slice(0, 10) ?? "",
              licenseExpiryDate:   license.licenseExpiryDate?.slice(0, 10) ?? "",
              commercialRegNo:     license.commercialRegNo ?? "",
              unifiedEntityNumber: license.unifiedEntityNumber ?? "",
              civilEntityNumber:   license.civilEntityNumber ?? "",
              fileNumber:          license.fileNumber ?? "",
              legalEntity:         license.legalEntity ?? "",
              capital:             license.capital ?? "",
              managerName:         license.managerName ?? "",
              managerPhone:        license.managerPhone ?? "",
              managerCivilId:      license.managerCivilId ?? "",
              email:               license.email ?? "",
              automaticNumber:     license.address?.automaticNumber ?? "",
              governorate:         license.address?.governorate ?? "",
              area:                license.address?.area ?? "",
              block:               license.address?.block ?? "",
              street:              license.address?.street ?? "",
              plot:                license.address?.plot ?? "",
              unitNumber:          license.address?.unitNumber ?? "",
              fileUrl:             commercialLicenseAttachment?.filePath ?? "",
              notes:               license.notes ?? "",
            })}
            editLabel="تعديل البيانات الأساسية"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {license.commercialRegNo && <><span className="text-muted-foreground">السجل التجاري</span><span dir="ltr">{license.commercialRegNo}</span></>}
              {license.issueDate && <><span className="text-muted-foreground">تاريخ الإصدار</span><span>{fmt(license.issueDate)}</span></>}
              {fmtDays(license.licenseExpiryDate)}
              {commercialLicenseAttachment && <><span className="text-muted-foreground">ملف الترخيص</span><span><FileLink url={commercialLicenseAttachment.filePath} label="عرض الملف" onDelete={() => deleteAttachment(commercialLicenseAttachment.id)} /></span></>}
            </div>
          </SectionCard>

          {/* [4] اعتماد توقيع صاحب العمل */}
          {isMainLicense && (
          <SectionCard icon={UserCheck} title="اعتماد توقيع صاحب العمل" status={statusMap.employer_cert}
            fileUrl={documentFile("employer_cert", s?.employerSignatureCert?.fileUrl ?? employerSignatureAttachment?.filePath)} lastUpdatedAt={documentUpdatedAt("employer_cert", employerSignatureAttachment?.createdAt)}
            onDelete={hasStoredSection("employer_cert", s?.employerSignatureCert, "EMPLOYER_SIGNATURE_CERT") ? () => deleteSimpleSection("employer_cert", "اعتماد توقيع صاحب العمل") : undefined}
            subtitle={s?.employerSignatureCert
              ? s.employerSignatureCert.signatories.length
                ? `المفوضون: ${s.employerSignatureCert.signatories.map((signatory) => signatory.nameAr).join("، ")}`
                : `ينتهي ${fmt(s.employerSignatureCert.expiryDate)}`
              : employerSignatureAttachment ? "مرفق مرفوع — استكمل الحفظ" : "لم يُدخل بعد"}
            onEdit={() => openModal("employer_cert", {
              fileNumber: s?.employerSignatureCert?.fileNumber ?? "",
              tradeName: s?.employerSignatureCert?.tradeName ?? "",
              companyCivilId: s?.employerSignatureCert?.companyCivilId ?? "",
              unifiedNumber: s?.employerSignatureCert?.unifiedNumber ?? "",
              governorate: s?.employerSignatureCert?.governorate ?? "",
              issueDate: s?.employerSignatureCert?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.employerSignatureCert?.expiryDate?.slice(0, 10) ?? "",
              fileUrl: s?.employerSignatureCert?.fileUrl ?? employerSignatureAttachment?.filePath ?? "",
              signatories: s?.employerSignatureCert?.signatories.map((sg) => ({ nameAr: sg.nameAr, nameEn: sg.nameEn ?? "" })) ?? [],
            })}
          >
            {s?.employerSignatureCert && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.employerSignatureCert.fileNumber && <><span className="text-muted-foreground">رقم الملف</span><span>{s.employerSignatureCert.fileNumber}</span></>}
                  {s.employerSignatureCert.issueDate && <><span className="text-muted-foreground">الإصدار</span><span>{fmt(s.employerSignatureCert.issueDate)}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.employerSignatureCert.expiryDate)}{fmtDays(s.employerSignatureCert.expiryDate)}</span>
                  {s.employerSignatureCert.signatories.length > 0 && (
                    <><span className="text-muted-foreground">المفوضون</span><span>{s.employerSignatureCert.signatories.map((sg) => sg.nameAr).join("، ")}</span></>
                  )}
                </div>
                <FileLink url={s.employerSignatureCert.fileUrl} label="عرض الشهادة" onDelete={() => deleteSimpleSection("employer_cert", "اعتماد توقيع صاحب العمل")} />
              </div>
            )}
            {!s?.employerSignatureCert && employerSignatureAttachment && <FileLink url={employerSignatureAttachment.filePath} label="عرض الملف المرفوع" onDelete={() => deleteAttachment(employerSignatureAttachment.id)} />}
          </SectionCard>

          )}

          {/* [5] إيصالات الإيجار */}
          <SectionCard icon={Receipt} title="إيصالات الإيجار" status={statusMap.rent_receipts}
            fileUrl={s?.rentReceipts[0]?.fileUrl ?? rentReceiptAttachment?.filePath} lastUpdatedAt={s?.rentReceipts[0]?.receiptDate ?? rentReceiptAttachment?.createdAt}
            subtitle={`${s?.rentReceipts.length ?? 0} إيصال${rentReceiptAttachment && (s?.rentReceipts.length ?? 0) === 0 ? " — مرفق مرفوع" : ""}`}
            onEdit={() => openModal("rent_receipt", { receiptDate: "", amount: "", fileUrl: rentReceiptAttachment?.filePath ?? "", notes: "" })}
            editLabel="إضافة إيصال"
          >
            {(s?.rentReceipts.length ?? 0) > 0 && (
              <div className="space-y-1">
                {s!.rentReceipts.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border bg-background/60 px-2 py-1.5 text-xs">
                    <span>سنة {r.receiptDate ? new Date(r.receiptDate).getFullYear() : "غير محددة"} · {fmt(r.receiptDate)}{r.amount ? ` · ${Number(r.amount).toFixed(3)} د.ك` : ""}</span>
                    <div className="flex items-center gap-2">
                      {r.fileUrl && (
                        <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/70" title="عرض الإيصال">
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => openModal("rent_receipt", { receiptDate: r.receiptDate?.slice(0, 10) ?? "", amount: r.amount ?? "", fileUrl: r.fileUrl, notes: r.notes ?? "" }, r.id)} className="text-primary hover:text-primary/70" title="تعديل"><Pencil size={12} /></button>
                      <button onClick={() => deleteRentReceipt(r.id)} className="text-red-400 hover:text-red-600" title="حذف"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(s?.rentReceipts.length ?? 0) === 0 && rentReceiptAttachment && <FileLink url={rentReceiptAttachment.filePath} label="عرض الإيصال المرفوع" onDelete={() => deleteAttachment(rentReceiptAttachment.id)} />}
          </SectionCard>

          {/* [6] ترخيص الاستيراد */}
          {isMainLicense && (
          <SectionCard icon={Globe} title="ترخيص الاستيراد العام" status={statusMap.import_license}
            fileUrl={documentFile("import_license", s?.importLicenseDoc?.fileUrl, "IMPORT_LICENSE")} lastUpdatedAt={documentUpdatedAt("import_license", recordUpdatedAt(s?.importLicenseDoc), "IMPORT_LICENSE")}
            onDelete={hasStoredSection("import_license", s?.importLicenseDoc, "IMPORT_LICENSE") ? () => deleteSimpleSection("import_license", "ترخيص الاستيراد العام") : undefined}
            subtitle={s?.importLicenseDoc ? `ينتهي ${fmt(s.importLicenseDoc.endDate)}` : "اختياري — لم يُدخل"}
            onEdit={() => openModal("import_license", {
              licenseNumber: s?.importLicenseDoc?.licenseNumber ?? "",
              startDate: s?.importLicenseDoc?.startDate?.slice(0, 10) ?? "",
              endDate: s?.importLicenseDoc?.endDate?.slice(0, 10) ?? "",
              fileUrl: s?.importLicenseDoc?.fileUrl ?? "",
            })}
          >
            {s?.importLicenseDoc && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.importLicenseDoc.licenseNumber && <><span className="text-muted-foreground">رقم الترخيص</span><span>{s.importLicenseDoc.licenseNumber}</span></>}
                  {s.importLicenseDoc.startDate && <><span className="text-muted-foreground">البداية</span><span>{fmt(s.importLicenseDoc.startDate)}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.importLicenseDoc.endDate)}</span>
                </div>
                <FileLink url={s.importLicenseDoc.fileUrl} label="عرض الترخيص" onDelete={() => deleteSimpleSection("import_license", "ترخيص الاستيراد العام")} />
                <VersionHistory versions={documentVersions} sectionType="import_license" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          )}

          {/* [7] ترخيص الإعلان */}
          <SectionCard icon={Megaphone} title="ترخيص الإعلان" status={statusMap.advertising}
            fileUrl={documentFile("advertising", s?.advertisingDetails?.fileUrl, "ADVERTISING_LICENSE")} lastUpdatedAt={documentUpdatedAt("advertising", recordUpdatedAt(s?.advertisingDetails), "ADVERTISING_LICENSE")}
            onDelete={hasStoredSection("advertising", s?.advertisingDetails, "ADVERTISING_LICENSE", license.advertisingLicenseExpiryDate) ? () => deleteSimpleSection("advertising", "ترخيص الإعلان") : undefined}
            subtitle={license.advertisingLicenseExpiryDate ? `ينتهي ${fmt(license.advertisingLicenseExpiryDate)}` : "لم يُدخل بعد"}
            onEdit={() => openModal("advertising", {
              adLicenseNumber: s?.advertisingDetails?.adLicenseNumber ?? "",
              commercialLicenseNo: s?.advertisingDetails?.commercialLicenseNo ?? "",
              issueDate: s?.advertisingDetails?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.advertisingDetails?.expiryDate?.slice(0, 10) ?? license.advertisingLicenseExpiryDate?.slice(0, 10) ?? "",
              commercialLicenseExpiry: s?.advertisingDetails?.commercialLicenseExpiry?.slice(0, 10) ?? "",
              municipalityAddress: s?.advertisingDetails?.municipalityAddress ?? "",
              district: s?.advertisingDetails?.district ?? "",
              street: s?.advertisingDetails?.street ?? "",
              block: s?.advertisingDetails?.block ?? "",
              fileUrl: s?.advertisingDetails?.fileUrl ?? "",
            })}
          >
            {s?.advertisingDetails && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.advertisingDetails.adLicenseNumber && <><span className="text-muted-foreground">رقم الترخيص</span><span>{s.advertisingDetails.adLicenseNumber}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.advertisingDetails.expiryDate)}{fmtDays(s.advertisingDetails.expiryDate)}</span>
                </div>
                <FileLink url={s.advertisingDetails.fileUrl} label="عرض الترخيص" onDelete={() => deleteSimpleSection("advertising", "ترخيص الإعلان")} />
                <VersionHistory versions={documentVersions} sectionType="advertising" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          {/* [8] رخصة الإطفاء */}
          <SectionCard icon={Shield} title="رخصة الإطفاء" status={statusMap.fire_safety}
            fileUrl={documentFile("fire_safety", s?.fireSafetyCert?.fileUrl, "FIRE_SAFETY_CERT")} lastUpdatedAt={documentUpdatedAt("fire_safety", recordUpdatedAt(s?.fireSafetyCert), "FIRE_SAFETY_CERT")}
            onDelete={hasStoredSection("fire_safety", s?.fireSafetyCert, "FIRE_SAFETY_CERT", license.fireLicenseExpiryDate) ? () => deleteSimpleSection("fire_safety", "رخصة الإطفاء") : undefined}
            subtitle={license.fireLicenseExpiryDate ? `ينتهي ${fmt(license.fireLicenseExpiryDate)}` : "لم يُدخل بعد"}
            onEdit={() => openModal("fire_safety", {
              licenseNumber: s?.fireSafetyCert?.licenseNumber ?? "",
              issueDate: s?.fireSafetyCert?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.fireSafetyCert?.expiryDate?.slice(0, 10) ?? license.fireLicenseExpiryDate?.slice(0, 10) ?? "",
              fileUrl: s?.fireSafetyCert?.fileUrl ?? "",
            })}
          >
            {s?.fireSafetyCert && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.fireSafetyCert.licenseNumber && <><span className="text-muted-foreground">رقم الرخصة</span><span>{s.fireSafetyCert.licenseNumber}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.fireSafetyCert.expiryDate)}{fmtDays(s.fireSafetyCert.expiryDate)}</span>
                </div>
                <FileLink url={s.fireSafetyCert.fileUrl} label="عرض الرخصة" onDelete={() => deleteSimpleSection("fire_safety", "رخصة الإطفاء")} />
                <VersionHistory versions={documentVersions} sectionType="fire_safety" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          <SectionCard icon={Shield} title="الترخيص الصحي" status={statusMap.health_license}
            fileUrl={documentFile("health_license", s?.healthLicense?.fileUrl, "HEALTH_LICENSE")} lastUpdatedAt={documentUpdatedAt("health_license", recordUpdatedAt(s?.healthLicense), "HEALTH_LICENSE")}
            onDelete={hasStoredSection("health_license", s?.healthLicense, "HEALTH_LICENSE", license.healthLicenseExpiryDate) ? () => deleteSimpleSection("health_license", "الترخيص الصحي") : undefined}
            subtitle={license.healthLicenseExpiryDate ? `ينتهي ${fmt(license.healthLicenseExpiryDate)}` : "لم يُدخل بعد"}
            onEdit={() => openModal("health_license", { licenseNumber: s?.healthLicense?.licenseNumber ?? "", issuingAuthority: s?.healthLicense?.issuingAuthority ?? "", issueDate: s?.healthLicense?.issueDate?.slice(0, 10) ?? "", expiryDate: s?.healthLicense?.expiryDate?.slice(0, 10) ?? license.healthLicenseExpiryDate?.slice(0, 10) ?? "", inspectionDate: s?.healthLicense?.inspectionDate?.slice(0, 10) ?? "", fileUrl: s?.healthLicense?.fileUrl ?? "", notes: s?.healthLicense?.notes ?? "" })}
          >
            {s?.healthLicense && <div className="space-y-2"><div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"><span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.healthLicense.expiryDate)}{fmtDays(s.healthLicense.expiryDate)}</span>{s.healthLicense.issuingAuthority && <><span className="text-muted-foreground">الجهة</span><span>{s.healthLicense.issuingAuthority}</span></>}</div><FileLink url={s.healthLicense.fileUrl} label="عرض الترخيص" onDelete={() => deleteSimpleSection("health_license", "الترخيص الصحي")} /></div>}
            <VersionHistory versions={documentVersions} sectionType="health_license" onDeleteVersion={deleteDocumentVersion} />
          </SectionCard>

          {/* [9] اعتماد المرور */}
          <SectionCard icon={Car} title="اعتماد المرور" status={statusMap.traffic_cert}
            fileUrl={documentFile("traffic_cert", s?.trafficCert?.fileUrl, "TRAFFIC_CERT")} lastUpdatedAt={documentUpdatedAt("traffic_cert", recordUpdatedAt(s?.trafficCert), "TRAFFIC_CERT")}
            onDelete={hasStoredSection("traffic_cert", s?.trafficCert, "TRAFFIC_CERT", license.trafficCertExpiryDate) ? () => deleteSimpleSection("traffic_cert", "اعتماد المرور") : undefined}
            subtitle={license.trafficCertExpiryDate ? `ينتهي ${fmt(license.trafficCertExpiryDate)}` : "لم يُدخل بعد"}
            onEdit={() => openModal("traffic_cert", {
              issueDate: s?.trafficCert?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.trafficCert?.expiryDate?.slice(0, 10) ?? license.trafficCertExpiryDate?.slice(0, 10) ?? "",
              fileUrl: s?.trafficCert?.fileUrl ?? "",
            })}
          >
            {s?.trafficCert && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.trafficCert.issueDate && <><span className="text-muted-foreground">الإصدار</span><span>{fmt(s.trafficCert.issueDate)}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.trafficCert.expiryDate)}{fmtDays(s.trafficCert.expiryDate)}</span>
                </div>
                <FileLink url={s.trafficCert.fileUrl} label="عرض الاعتماد" onDelete={() => deleteSimpleSection("traffic_cert", "اعتماد المرور")} />
                <VersionHistory versions={documentVersions} sectionType="traffic_cert" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          {/* [10] اعتماد الجمارك */}
          {isMainLicense && (
          <SectionCard icon={Truck} title="اعتماد الجمارك" status={statusMap.customs_cert}
            fileUrl={documentFile("customs_cert", s?.customsCert?.fileUrl, "CUSTOMS_CERT")} lastUpdatedAt={documentUpdatedAt("customs_cert", recordUpdatedAt(s?.customsCert), "CUSTOMS_CERT")}
            onDelete={hasStoredSection("customs_cert", s?.customsCert, "CUSTOMS_CERT", license.customsCertExpiryDate) ? () => deleteSimpleSection("customs_cert", "اعتماد الجمارك") : undefined}
            subtitle={license.customsCertExpiryDate ? `ينتهي ${fmt(license.customsCertExpiryDate)}` : "اختياري — لم يُدخل"}
            onEdit={() => openModal("customs_cert", {
              issueDate: s?.customsCert?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.customsCert?.expiryDate?.slice(0, 10) ?? "",
              fileUrl: s?.customsCert?.fileUrl ?? "",
            })}
          >
            {s?.customsCert && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.customsCert.issueDate && <><span className="text-muted-foreground">الإصدار</span><span>{fmt(s.customsCert.issueDate)}</span></>}
                  <span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.customsCert.expiryDate)}{fmtDays(s.customsCert.expiryDate)}</span>
                </div>
                <FileLink url={s.customsCert.fileUrl} label="عرض الاعتماد" onDelete={() => deleteSimpleSection("customs_cert", "اعتماد الجمارك")} />
                <VersionHistory versions={documentVersions} sectionType="customs_cert" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          )}

          {/* [11] المركبات */}
          <SectionCard icon={Car} title="المركبات" status={statusMap.vehicles}
            subtitle={`${s?.licenseVehicles.length ?? 0} مركبة`}
            onEdit={() => openModal("vehicle_add", { vehicleType: "", plateNumber: "", model: "", year: "", insuranceExpiry: "", licenseExpiry: "", notes: "" })}
            editLabel="إضافة مركبة"
          >
            {(s?.licenseVehicles.length ?? 0) > 0 && (
              <div className="space-y-2">
                {s!.licenseVehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs">
                    <div>
                      <span className="font-medium">{v.plateNumber}</span>
                      {v.vehicleType && <span className="text-muted-foreground mr-2">{v.vehicleType}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {v.insuranceExpiry && <span className={expiryStatus(v.insuranceExpiry) === "danger" ? "text-red-500" : expiryStatus(v.insuranceExpiry) === "warning" ? "text-yellow-500" : ""}>{fmt(v.insuranceExpiry)}</span>}
                      <button onClick={() => openModal("vehicle_edit", { vehicleType: v.vehicleType, plateNumber: v.plateNumber, model: v.model ?? "", year: v.year ?? "", insuranceExpiry: v.insuranceExpiry?.slice(0, 10) ?? "", licenseExpiry: v.licenseExpiry?.slice(0, 10) ?? "", notes: v.notes ?? "" }, v.id)} className="text-primary hover:text-primary/70"><Pencil size={12} /></button>
                      <button onClick={() => deleteVehicle(v.id)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* [12] وكالة المدير */}
          <SectionCard icon={UserCheck} title="وكالة المدير" status={statusMap.manager_poa}
            fileUrl={documentFile("manager_poa", s?.managerPOA?.fileUrl, "MANAGER_POA")} lastUpdatedAt={documentUpdatedAt("manager_poa", recordUpdatedAt(s?.managerPOA), "MANAGER_POA")}
            onDelete={hasStoredSection("manager_poa", s?.managerPOA, "MANAGER_POA") ? () => deleteSimpleSection("manager_poa", "وكالة المدير") : undefined}
            subtitle={s?.managerPOA ? `${s.managerPOA.agentName ?? "—"} · ${fmt(s.managerPOA.expiryDate)}` : "لم يُدخل بعد"}
            onEdit={() => openModal("manager_poa", {
              principalName: s?.managerPOA?.principalName ?? "",
              agentName: s?.managerPOA?.agentName ?? "",
              issueDate: s?.managerPOA?.issueDate?.slice(0, 10) ?? "",
              expiryDate: s?.managerPOA?.expiryDate?.slice(0, 10) ?? "",
              fileUrl: s?.managerPOA?.fileUrl ?? "",
              notes: s?.managerPOA?.notes ?? "",
            })}
          >
            {s?.managerPOA && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {s.managerPOA.principalName && <><span className="text-muted-foreground">الموكِّل</span><span>{s.managerPOA.principalName}</span></>}
                  {s.managerPOA.agentName && <><span className="text-muted-foreground">الموكَّل إليه</span><span>{s.managerPOA.agentName}</span></>}
                  {s.managerPOA.expiryDate && <><span className="text-muted-foreground">الانتهاء</span><span>{fmt(s.managerPOA.expiryDate)}</span></>}
                </div>
                <FileLink url={s.managerPOA.fileUrl} label="عرض الوكالة" onDelete={() => deleteSimpleSection("manager_poa", "وكالة المدير")} />
                <VersionHistory versions={documentVersions} sectionType="manager_poa" onDeleteVersion={deleteDocumentVersion} />
              </div>
            )}
          </SectionCard>

          {/* [13] تأمين إصابات العمل */}
          {isMainLicense && (
          <SectionCard icon={Shield} title="تأمين إصابات العمل" status={statusMap.work_injury}
            fileUrl={latestWorkInjury?.fileUrl} lastUpdatedAt={latestWorkInjury?.updatedAt ?? latestWorkInjury?.createdAt}
            subtitle={latestWorkInjury ? `${latestWorkInjury.year} · الربع ${latestWorkInjury.quarter} · ينتهي سجل الربع ${fmt(latestWorkInjuryQuarterExpiry?.toISOString() ?? null)}${latestWorkInjury.endDate ? ` · الشهادة تنتهي ${fmt(latestWorkInjury.endDate)}` : ""}` : "لم تُدخل وثيقة بعد"}
            onEdit={() => openModal("work_injury", { year: new Date().getFullYear(), quarter: String(Math.floor(new Date().getMonth() / 3) + 1), policyNumber: "", certificateNo: "", startDate: "", endDate: "", fileUrl: "" })}
            editLabel="إضافة/تحديث وثيقة"
          >
            {(s?.workInjuryInsurances.length ?? 0) > 0 && (
                <div className="space-y-2">
                {s!.workInjuryInsurances.slice(0, 4).map((w) => (
                    <div key={w.id} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{w.year} — {QUARTER_LABELS[w.quarter]}</span>
                        <span className="text-muted-foreground">{`\u0622\u062e\u0631 \u062a\u0639\u062f\u064a\u0644: ${fmt(w.updatedAt)}`}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {w.policyNumber && `${"\u0631\u0642\u0645 \u0627\u0644\u0648\u062b\u064a\u0642\u0629"}: ${w.policyNumber}`}
                        {w.policyNumber && w.certificateNo && " · "}
                        {w.certificateNo && `${"\u0631\u0642\u0645 \u0627\u0644\u0634\u0647\u0627\u062f\u0629"}: ${w.certificateNo}`}
                        {(w.policyNumber || w.certificateNo) && " · "}
                        {`${"\u0627\u0646\u062a\u0647\u0627\u0621 \u0633\u062c\u0644 \u0627\u0644\u0631\u0628\u0639"}: ${fmt(workInjuryQuarterExpiryDate(w.year, w.quarter).toISOString())}`}
                        {w.endDate && ` · ${"\u0627\u0646\u062a\u0647\u0627\u0621 \u0627\u0644\u0634\u0647\u0627\u062f\u0629"}: ${fmt(w.endDate)}`}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {w.fileUrl && (
                          <a href={w.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-primary hover:bg-background" title="عرض الوثيقة">
                            <ExternalLink size={12} /> {"\u0639\u0631\u0636 \u0627\u0644\u0645\u0644\u0641"}
                          </a>
                        )}
                        <button onClick={() => openModal("work_injury", { year: w.year, quarter: String(w.quarter), policyNumber: w.policyNumber ?? "", certificateNo: w.certificateNo ?? "", startDate: w.startDate?.slice(0, 10) ?? "", endDate: w.endDate?.slice(0, 10) ?? "", fileUrl: w.fileUrl ?? "" })} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-primary hover:bg-background" title="تعديل"><Pencil size={12} /> {"\u062a\u0639\u062f\u064a\u0644"}</button>
                        <button onClick={() => deleteWorkInjury(w.year, w.quarter)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50" title="حذف"><Trash2 size={12} /> {"\u062d\u0630\u0641"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <VersionHistory versions={documentVersions} sectionType="work_injury" />
          </SectionCard>

          )}

          {/* [14] الميزانية السنوية */}
          <SectionCard icon={BarChart3} title="الميزانية السنوية" status={statusMap.annual_balance}
            fileUrl={s?.annualBalances[0]?.fileUrl ?? annualBalanceAttachment?.filePath} lastUpdatedAt={annualBalanceAttachment?.createdAt}
            subtitle={`${s?.annualBalances.length ?? 0} سنة مُدخلة${annualBalanceAttachment && (s?.annualBalances.length ?? 0) === 0 ? " — مرفق مرفوع" : ""}`}
            onEdit={() => openModal("annual_balance", { year: new Date().getFullYear() - 1, accountant: "", fileUrl: annualBalanceAttachment?.filePath ?? "", notes: "" })}
            editLabel="إضافة ميزانية"
          >
            {(s?.annualBalances.length ?? 0) > 0 && (
              <div className="space-y-1">
                {s!.annualBalances.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">سنة {b.year}{b.accountant ? ` · ${b.accountant}` : ""}</span>
                    <div className="flex items-center gap-2">
                      {b.fileUrl && (
                        <a href={b.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/70" title="عرض الميزانية">
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button onClick={() => openModal("annual_balance", { year: b.year, accountant: b.accountant ?? "", fileUrl: b.fileUrl, notes: b.notes ?? "" }, b.id)} className="text-primary hover:text-primary/70" title="تعديل"><Pencil size={12} /></button>
                      <button onClick={() => deleteAnnualBalance(b.id)} className="text-red-400 hover:text-red-600" title="حذف"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(s?.annualBalances.length ?? 0) === 0 && annualBalanceAttachment && <FileLink url={annualBalanceAttachment.filePath} label="عرض الميزانية المرفوعة" onDelete={() => deleteAttachment(annualBalanceAttachment.id)} />}
          </SectionCard>

        </div>

        {/* Employees & Sub-licenses */}
        {license._count.employees > 0 && (
          <div className="section-card space-y-3">
            <div className="flex items-center gap-2"><Users size={15} className="text-primary" /><h3 className="font-semibold text-sm">الموظفون ({license._count.employees})</h3></div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {license.employees.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-muted/20 px-3 py-2 text-xs">
                  <span className="font-medium">{e.nameAr}</span>
                  <span className={`rounded-full px-2 py-0.5 ${e.employmentStatus === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{e.employmentStatus === "ACTIVE" ? "نشط" : e.employmentStatus}</span>
                </div>
              ))}
              {license._count.employees > 10 && <p className="text-xs text-muted-foreground mt-1">+{license._count.employees - 10} موظف آخر</p>}
            </div>
          </div>
        )}

        {license.isMainLicense && license._count.branchLicenses > 0 && (
          <div className="section-card space-y-3">
            <div className="flex items-center gap-2"><Building2 size={15} className="text-blue-500" /><h3 className="font-semibold text-sm">التراخيص الفرعية ({license._count.branchLicenses})</h3></div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {license.branchLicenses.map((sub) => (
                <button key={sub.id} onClick={() => router.push(`/dashboard/companies/${companyId}/licenses/${sub.id}`)}
                  className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2 text-xs hover:bg-muted/30 text-right">
                  <span className="font-medium text-blue-700">{sub.commercialNameAr}</span>
                  <span className="font-mono text-muted-foreground">{sub.licenseNumber}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════ MODALS ═══════════ */}

      {/* [1] عقد التأسيس */}
      {isMainLicense && modal === "establishment" && (
        <Modal title="عقد التأسيس" wide onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ العقد</label><input type="date" className="input-field w-full" value={form.contractDate as string ?? ""} onChange={f("contractDate")} /></div>
            </div>
              <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف العقد" documentCategory="ESTABLISHMENT_CONTRACT" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {/* Partners */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">الشركاء</label>
                <button type="button" onClick={() => setForm((p) => ({ ...p, partners: [...(p.partners as object[] ?? []), { nameAr: "", nameEn: "", civilId: "", sharePercent: "0", isDirector: false }] }))}
                  className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> إضافة شريك</button>
              </div>
              {(form.partners as { nameAr: string; nameEn: string; civilId: string; sharePercent: string; isDirector: boolean }[] ?? []).map((p, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                  <input className="input-field col-span-2" placeholder="الاسم" value={p.nameAr} onChange={(e) => updatePartner(i, "nameAr", e.target.value)} />
                  <input className="input-field" placeholder="الرقم المدني" value={p.civilId} onChange={(e) => updatePartner(i, "civilId", e.target.value)} />
                  <input type="number" min="0" max="100" step="0.01" className="input-field" placeholder="0-100%" value={p.sharePercent} onChange={(e) => updatePartner(i, "sharePercent", e.target.value)} />
                  <div className="flex items-center gap-1">
                    <input type="checkbox" checked={p.isDirector} onChange={(e) => updatePartner(i, "isDirector", e.target.checked)} />
                    <span className="text-xs">مدير</span>
                    <button type="button" onClick={() => setForm((prev) => { const arr = (prev.partners as object[]).filter((_, j) => j !== i); return { ...prev, partners: arr }; })} className="text-red-400 hover:text-red-600 mr-1"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
                <button onClick={() => { void saveEstContract(); }} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [2] عقد الإيجار */}
      {modal === "lease" && (
        <Modal title="عقد الإيجار" wide onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">الإيجار على</label>
              <select className="input-field w-full" value={form.holderType as string} onChange={f("holderType")}>
                <option value="INVESTOR">المسئول والمدير</option><option value="GROUP_OWNER">صاحب المجموعة</option><option value="OTHER_KUWAITI">كويتي آخر</option>
              </select>
            </div>
            {form.holderType === "OTHER_KUWAITI" && <div><label className="form-label">اسم الكويتي</label><input className="input-field w-full" value={form.holderNameAr as string ?? ""} onChange={f("holderNameAr")} /></div>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">من تاريخ</label><input type="date" className="input-field w-full" value={form.startDate as string ?? ""} onChange={f("startDate")} /></div>
              <div><label className="form-label">إلى تاريخ</label><input type="date" className="input-field w-full" value={form.endDate as string ?? ""} onChange={f("endDate")} /></div>
            </div>
            <div><label className="form-label">الإيجار الشهري (د.ك)</label><input type="number" step="0.001" className="input-field w-full" value={form.monthlyRent as string ?? ""} onChange={f("monthlyRent")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف العقد" documentCategory="LEASE_CONTRACT" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveLeaseContract} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [4] اعتماد توقيع صاحب العمل */}
      {isMainLicense && modal === "employer_cert" && (
        <Modal title="اعتماد توقيع صاحب العمل" wide onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">رقم الملف</label><input className="input-field w-full" value={form.fileNumber as string ?? ""} onChange={f("fileNumber")} /></div>
              <div><label className="form-label">الاسم التجاري</label><input className="input-field w-full" value={form.tradeName as string ?? ""} onChange={f("tradeName")} /></div>
              <div><label className="form-label">الرقم المدني للشركة</label><input className="input-field w-full" dir="ltr" value={form.companyCivilId as string ?? ""} onChange={f("companyCivilId")} /></div>
              <div><label className="form-label">الرقم الموحد</label><input className="input-field w-full" dir="ltr" value={form.unifiedNumber as string ?? ""} onChange={f("unifiedNumber")} /></div>
              <div><label className="form-label">المحافظة</label><input className="input-field w-full" value={form.governorate as string ?? ""} onChange={f("governorate")} /></div>
              <div></div>
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الشهادة" documentCategory="EMPLOYER_SIGNATURE_CERT" />
            {/* Signatories */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="form-label mb-0">المفوضون بالتوقيع</label>
                <button type="button" onClick={() => setForm((p) => ({ ...p, signatories: [...(p.signatories as object[] ?? []), { nameAr: "", nameEn: "" }] }))}
                  className="text-xs text-primary hover:underline flex items-center gap-1"><Plus size={12} /> إضافة</button>
              </div>
              {(form.signatories as { nameAr: string; nameEn: string }[] ?? []).map((sg, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input className="input-field flex-1" placeholder="الاسم بالعربي" value={sg.nameAr} onChange={(e) => setForm((prev) => { const signatories = [...(prev.signatories as { nameAr: string; nameEn: string }[])]; signatories[i] = { ...signatories[i], nameAr: e.target.value }; return { ...prev, signatories }; })} />
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, signatories: (prev.signatories as object[]).filter((_, j) => j !== i) }))} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("employer_cert")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {isMainLicense && modal === "partner_civil_id" && (
        <Modal title={editTarget ? "تعديل بطاقة شريك" : "إضافة بطاقة شريك"} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">الشريك *</label><select className="input-field w-full" value={form.partnerNameAr as string ?? ""} onChange={f("partnerNameAr")}><option value="">— اختر الشريك —</option>{displayedPartners.map((partner) => <option key={partner.id} value={partner.nameAr}>{partner.nameAr}</option>)}</select></div>
            <div><label className="form-label">الرقم المدني</label><input className="input-field w-full" dir="ltr" value={form.civilId as string ?? ""} onChange={f("civilId")} /></div>
            <div><label className="form-label">تاريخ انتهاء البطاقة</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="صورة البطاقة المدنية *" required={!editTarget} documentCategory="PARTNER_CIVIL_ID" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button><button onClick={savePartnerCivilId} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button></div>
          </div>
        </Modal>
      )}

      {modal === "violation" && (
        <Modal title={editTarget ? "تعديل مخالفة ترخيص" : "إضافة مخالفة ترخيص"} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">تاريخ المخالفة *</label><input type="date" className="input-field w-full" value={form.violationDate as string ?? ""} onChange={f("violationDate")} /></div>
            <div><label className="form-label">اسم صاحب المخالفة *</label><input className="input-field w-full" value={form.violatorName as string ?? ""} onChange={f("violatorName")} /></div>
            <div><label className="form-label">قيمة المخالفة (د.ك) *</label><input type="number" step="0.001" min="0" className="input-field w-full" value={form.amount as string ?? ""} onChange={f("amount")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="صورة المخالفة *" required={!editTarget} documentCategory="LICENSE_VIOLATION" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button><button onClick={saveViolation} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button></div>
          </div>
        </Modal>
      )}

      {/* [5] إيصال الإيجار */}
      {modal === "rent_receipt" && (
        <Modal title={editTarget ? "تعديل إيصال إيجار" : "إضافة إيصال إيجار"} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">تاريخ الإيصال</label><input type="date" className="input-field w-full" value={form.receiptDate as string ?? ""} onChange={f("receiptDate")} /></div>
            <div><label className="form-label">المبلغ (د.ك)</label><input type="number" step="0.001" className="input-field w-full" value={form.amount as string ?? ""} onChange={f("amount")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="صورة الإيصال" required={!editTarget} documentCategory="RENT_RECEIPT" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveRentReceipt} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [6] ترخيص الاستيراد */}
      {isMainLicense && modal === "import_license" && (
        <Modal title="ترخيص الاستيراد العام" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">رقم الترخيص</label><input className="input-field w-full" dir="ltr" value={form.licenseNumber as string ?? ""} onChange={f("licenseNumber")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ البداية</label><input type="date" className="input-field w-full" value={form.startDate as string ?? ""} onChange={f("startDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.endDate as string ?? ""} onChange={f("endDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الترخيص" documentCategory="IMPORT_LICENSE" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("import_license")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [7] ترخيص الإعلان */}
      {modal === "advertising" && (
        <Modal title="ترخيص الإعلان" wide onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">رقم ترخيص الإعلان</label><input className="input-field w-full" dir="ltr" value={form.adLicenseNumber as string ?? ""} onChange={f("adLicenseNumber")} /></div>
              <div><label className="form-label">رقم الترخيص التجاري</label><input className="input-field w-full" dir="ltr" value={form.commercialLicenseNo as string ?? ""} onChange={f("commercialLicenseNo")} /></div>
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
              <div><label className="form-label">المنطقة</label><input className="input-field w-full" value={form.district as string ?? ""} onChange={f("district")} /></div>
              <div><label className="form-label">الشارع</label><input className="input-field w-full" value={form.street as string ?? ""} onChange={f("street")} /></div>
              <div><label className="form-label">القطعة</label><input className="input-field w-full" value={form.block as string ?? ""} onChange={f("block")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الترخيص" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("advertising")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [8] رخصة الإطفاء */}
      {modal === "fire_safety" && (
        <Modal title="رخصة الإطفاء" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">رقم الرخصة</label><input className="input-field w-full" dir="ltr" value={form.licenseNumber as string ?? ""} onChange={f("licenseNumber")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الرخصة" documentCategory="FIRE_SAFETY_CERT" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("fire_safety")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "health_license" && (
        <Modal title="الترخيص الصحي" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">رقم الترخيص</label><input className="input-field w-full" dir="ltr" value={form.licenseNumber as string ?? ""} onChange={f("licenseNumber")} /></div>
            <div><label className="form-label">الجهة المانحة</label><input className="input-field w-full" value={form.issuingAuthority as string ?? ""} onChange={f("issuingAuthority")} /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div><div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div></div>
            <div><label className="form-label">آخر فحص صحي</label><input type="date" className="input-field w-full" value={form.inspectionDate as string ?? ""} onChange={f("inspectionDate")} /></div>
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الترخيص الصحي" documentCategory="HEALTH_LICENSE" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1"><button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button><button onClick={() => saveSection("health_license")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button></div>
          </div>
        </Modal>
      )}

      {/* [9] اعتماد المرور */}
      {modal === "traffic_cert" && (
        <Modal title="اعتماد المرور" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الاعتماد" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("traffic_cert")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [10] اعتماد الجمارك */}
      {isMainLicense && modal === "customs_cert" && (
        <Modal title="اعتماد الجمارك" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الاعتماد" />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("customs_cert")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [11] مركبة */}
      {(modal === "vehicle_add" || modal === "vehicle_edit") && (
        <Modal title={modal === "vehicle_edit" ? "تعديل المركبة" : "إضافة مركبة"} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">نوع المركبة</label><input className="input-field w-full" placeholder="سيارة / شاحنة..." value={form.vehicleType as string ?? ""} onChange={f("vehicleType")} /></div>
              <div><label className="form-label">رقم اللوحة *</label><input className="input-field w-full" dir="ltr" value={form.plateNumber as string ?? ""} onChange={f("plateNumber")} /></div>
              <div><label className="form-label">الموديل</label><input className="input-field w-full" value={form.model as string ?? ""} onChange={f("model")} /></div>
              <div><label className="form-label">سنة الصنع</label><input type="number" className="input-field w-full" value={form.year as string ?? ""} onChange={f("year")} /></div>
              <div><label className="form-label">انتهاء التأمين</label><input type="date" className="input-field w-full" value={form.insuranceExpiry as string ?? ""} onChange={f("insuranceExpiry")} /></div>
              <div><label className="form-label">انتهاء الرخصة</label><input type="date" className="input-field w-full" value={form.licenseExpiry as string ?? ""} onChange={f("licenseExpiry")} /></div>
            </div>
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveVehicle} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [12] وكالة المدير */}
      {modal === "manager_poa" && (
        <Modal title="وكالة المدير" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">اسم الموكِّل</label><input className="input-field w-full" value={form.principalName as string ?? ""} onChange={f("principalName")} /></div>
            <div><label className="form-label">اسم الموكَّل إليه</label><input className="input-field w-full" value={form.agentName as string ?? ""} onChange={f("agentName")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">تاريخ الإصدار</label><input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.expiryDate as string ?? ""} onChange={f("expiryDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الوكالة" documentCategory="MANAGER_POA" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={() => saveSection("manager_poa")} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [13] تأمين إصابات العمل */}
      {isMainLicense && modal === "work_injury" && (
        <Modal title="وثيقة تأمين إصابات العمل" onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="form-label">السنة *</label><input type="number" className="input-field w-full" value={form.year as string ?? ""} onChange={f("year")} /></div>
              <div><label className="form-label">الربع *</label>
                <select className="input-field w-full" value={form.quarter as string ?? ""} onChange={f("quarter")}>
                  <option value="">— اختر الربع —</option>
                  <option value="1">الأول (يناير–مارس)</option>
                  <option value="2">الثاني (أبريل–يونيو)</option>
                  <option value="3">الثالث (يوليو–سبتمبر)</option>
                  <option value="4">الرابع (أكتوبر–ديسمبر)</option>
                </select>
              </div>
              <div><label className="form-label">رقم الوثيقة</label><input className="input-field w-full" dir="ltr" value={form.policyNumber as string ?? ""} onChange={f("policyNumber")} /></div>
              <div><label className="form-label">رقم الشهادة</label><input className="input-field w-full" dir="ltr" value={form.certificateNo as string ?? ""} onChange={f("certificateNo")} /></div>
              <div><label className="form-label">تاريخ البداية</label><input type="date" className="input-field w-full" value={form.startDate as string ?? ""} onChange={f("startDate")} /></div>
              <div><label className="form-label">تاريخ الانتهاء</label><input type="date" className="input-field w-full" value={form.endDate as string ?? ""} onChange={f("endDate")} /></div>
            </div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الوثيقة" documentCategory="WORK_INJURY" onUploaded={(fileUrl) => { void saveWorkInjuryFile(fileUrl); }} />
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveWorkInjury} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* [14] الميزانية السنوية */}
      {/* ── تعديل البيانات الأساسية ── */}
      {modal === "basic_info" && (
        <Modal title="تعديل البيانات الأساسية" wide onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="form-label">الاسم التجاري العربي *</label>
                <input className="input-field w-full" value={form.commercialNameAr as string ?? ""} onChange={f("commercialNameAr")} />
              </div>
              <div>
                <label className="form-label">رقم الترخيص *</label>
                <input className="input-field w-full" dir="ltr" value={form.licenseNumber as string ?? ""} onChange={f("licenseNumber")} />
              </div>
              <div>
                <label className="form-label">حالة الترخيص</label>
                <select className="input-field w-full" value={form.status as string ?? "ACTIVE"} onChange={f("status")}>
                  <option value="ACTIVE">فعال</option>
                  <option value="SUSPENDED">موقوف</option>
                  <option value="EXPIRED">منتهي</option>
                  <option value="CANCELLED">ملغاة</option>
                </select>
              </div>
{license.isMainLicense ? null : (
                <div>
                  <label className="form-label">الترخيص الرئيسي</label>
                  <select className="input-field w-full" value={form.mainLicenseId as string ?? ""} onChange={f("mainLicenseId")}>
                    <option value="">— اختر الترخيص الرئيسي —</option>
                    {mainLicenses.filter((item) => item.id !== license.id).map((item) => (
                      <option key={item.id} value={item.id}>{item.commercialNameAr} ({item.licenseNumber})</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="form-label">المسئول والمدير</label>
                <select className="input-field w-full" value={form.investorId as string ?? ""} onChange={f("investorId")}>
                  <option value="">— بدون مسئول —</option>
                  {investors.map((i) => <option key={i.id} value={i.id}>{i.nameAr}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">تاريخ الإصدار</label>
                <input type="date" className="input-field w-full" value={form.issueDate as string ?? ""} onChange={f("issueDate")} />
              </div>
              <div>
                <label className="form-label">تاريخ الانتهاء</label>
                <input type="date" className="input-field w-full" value={form.licenseExpiryDate as string ?? ""} onChange={f("licenseExpiryDate")} />
              </div>
              <div>
                <label className="form-label">السجل التجاري</label>
                <input className="input-field w-full" dir="ltr" value={form.commercialRegNo as string ?? ""} onChange={f("commercialRegNo")} />
              </div>
              <div>
                <label className="form-label">الرقم الموحد</label>
                <input className="input-field w-full" dir="ltr" value={form.unifiedEntityNumber as string ?? ""} onChange={f("unifiedEntityNumber")} />
              </div>
              <div>
                <label className="form-label">رقم الجهة المدني</label>
                <input className="input-field w-full" dir="ltr" value={form.civilEntityNumber as string ?? ""} onChange={f("civilEntityNumber")} />
              </div>
              <div>
                <label className="form-label">رقم الملف</label>
                <input className="input-field w-full" dir="ltr" value={form.fileNumber as string ?? ""} onChange={f("fileNumber")} />
              </div>
              <div>
                <label className="form-label">الشكل القانوني</label>
                <select className="input-field w-full" value={form.legalEntity as string ?? ""} onChange={f("legalEntity")}>
                  <option value="">— اختر —</option>
                  <option value="LLC">ذات مسؤولية محدودة</option>
                  <option value="PARTNERSHIP">شراكة</option>
                  <option value="JOINT_STOCK">مساهمة</option>
                  <option value="SOLE_PROPRIETORSHIP">فردي</option>
                </select>
              </div>
              <div>
                <label className="form-label">رأس المال (د.ك)</label>
                <input type="number" className="input-field w-full" dir="ltr" value={form.capital as string ?? ""} onChange={f("capital")} />
              </div>
              <div>
                <label className="form-label">اسم المدير</label>
                <input className="input-field w-full" value={form.managerName as string ?? ""} onChange={f("managerName")} />
              </div>
              <div>
                <label className="form-label">هاتف المدير</label>
                <input className="input-field w-full" dir="ltr" value={form.managerPhone as string ?? ""} onChange={f("managerPhone")} />
              </div>
              <div>
                <label className="form-label">الرقم المدني للمفوض بالتوقيع</label>
                <input className="input-field w-full" dir="ltr" value={form.managerCivilId as string ?? ""} onChange={f("managerCivilId")} />
              </div>
              <div>
                <label className="form-label">الايميل</label>
                <input type="email" className="input-field w-full" dir="ltr" value={form.email as string ?? ""} onChange={f("email")} />
              </div>
            </div>

            {/* بيانات العنوان */}
            <div className="border-t pt-3">
              <h4 className="text-sm font-medium mb-3">بيانات العنوان</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">الرقم الآلي للعنوان</label>
                  <input className="input-field w-full" dir="ltr" value={form.automaticNumber as string ?? ""} onChange={f("automaticNumber")} />
                </div>
                <div>
                  <label className="form-label">المحافظة</label>
                  <input className="input-field w-full" value={form.governorate as string ?? ""} onChange={f("governorate")} />
                </div>
                <div>
                  <label className="form-label">المنطقة</label>
                  <input className="input-field w-full" value={form.area as string ?? ""} onChange={f("area")} />
                </div>
                <div>
                  <label className="form-label">القطعة</label>
                  <input className="input-field w-full" value={form.block as string ?? ""} onChange={f("block")} />
                </div>
                <div>
                  <label className="form-label">الشارع</label>
                  <input className="input-field w-full" value={form.street as string ?? ""} onChange={f("street")} />
                </div>
                <div>
                  <label className="form-label">القسيمة</label>
                  <input className="input-field w-full" value={form.plot as string ?? ""} onChange={f("plot")} />
                </div>
                <div>
                  <label className="form-label">الوحدة</label>
                  <input className="input-field w-full" value={form.unitNumber as string ?? ""} onChange={f("unitNumber")} />
                </div>
              </div>
            </div>

            <FileUploadField
              value={form.fileUrl as string ?? ""}
              onChange={setFileUrl}
              onUploaded={load}
              licenseId={licenseId}
              label="ملف الترخيص"
              documentCategory="COMMERCIAL_LICENSE"
            />
            <div>
              <label className="form-label">ملاحظات</label>
              <textarea className="input-field w-full resize-none" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} />
            </div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveBasicInfo} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === "annual_balance" && (
        <Modal title={editTarget ? "تعديل الميزانية السنوية" : "إضافة ميزانية سنوية"} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div><label className="form-label">السنة</label><input type="number" className="input-field w-full" value={form.year as string ?? ""} onChange={f("year")} /></div>
            <div><label className="form-label">اسم المحاسب القانوني</label><input className="input-field w-full" value={form.accountant as string ?? ""} onChange={f("accountant")} /></div>
            <FileUploadField value={form.fileUrl as string ?? ""} onChange={setFileUrl} licenseId={licenseId} label="ملف الميزانية" required={!editTarget} documentCategory="ANNUAL_BALANCE" />
            <div><label className="form-label">ملاحظات</label><textarea className="input-field w-full" rows={2} value={form.notes as string ?? ""} onChange={f("notes")} /></div>
            {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">إلغاء</button>
              <button onClick={saveAnnualBalance} disabled={saving} className="btn-primary rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ"}</button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}






