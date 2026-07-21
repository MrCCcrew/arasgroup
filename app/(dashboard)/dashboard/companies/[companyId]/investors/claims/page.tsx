import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ClaimStatusActions } from "@/components/investors/claim-status-actions";
import { ClaimEditDeleteActions } from "@/components/investors/claim-edit-delete-actions";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { ClaimsList, type ClaimListItem } from "@/components/investors/claims-list";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ status?: string }>;
}

const statusLabels = {
  ar: {
    PENDING: "معلق",
    SENT_TO_ACCOUNTANT: "أُرسل للمحاسب",
    SENT_TO_INVESTOR: "أُرسل للمسئول",
    PARTIALLY_COLLECTED: "محصل جزئياً",
    COLLECTED: "تم التحصيل",
    COMPLETED: "تم التنفيذ",
    PAID: "مدفوع",
    RENEWED: "تم التجديد",
    OVERDUE: "متأخر",
    SETTLED: "مسوى",
    CANCELLED: "ملغي",
  },
  en: {
    PENDING: "Pending",
    SENT_TO_ACCOUNTANT: "Sent to accountant",
    SENT_TO_INVESTOR: "Sent to investor",
    PARTIALLY_COLLECTED: "Partially collected",
    COLLECTED: "Collected",
    COMPLETED: "Completed",
    PAID: "Paid",
    RENEWED: "Renewed",
    OVERDUE: "Overdue",
    SETTLED: "Settled",
    CANCELLED: "Cancelled",
  },
} as const;

const typeLabels = {
  ar: {
    LICENSE_RENEWAL: "تجديد رخصة",
    RESIDENCY_RENEWAL: "تجديد إقامة",
    RENT: "إيجار",
    SALARY_FUNDING: "تمويل رواتب",
    ADMIN_FEE: "رسوم إدارية",
    FINE: "غرامة",
    OTHER: "أخرى",
  },
  en: {
    LICENSE_RENEWAL: "License renewal",
    RESIDENCY_RENEWAL: "Residency renewal",
    RENT: "Rent",
    SALARY_FUNDING: "Salary funding",
    ADMIN_FEE: "Administrative fee",
    FINE: "Fine",
    OTHER: "Other",
  },
} as const;

const statusColors: Record<string, string> = {
  PENDING:              "bg-yellow-50 text-yellow-700",
  SENT_TO_ACCOUNTANT:   "bg-blue-50 text-blue-700",
  SENT_TO_INVESTOR:     "bg-indigo-50 text-indigo-700",
  PARTIALLY_COLLECTED:  "bg-amber-50 text-amber-700",
  COLLECTED:            "bg-teal-50 text-teal-700",
  COMPLETED:            "bg-green-50 text-green-700",
  PAID:                 "bg-green-50 text-green-700",
  RENEWED:              "bg-emerald-50 text-emerald-700",
  OVERDUE:              "bg-red-50 text-red-700",
  SETTLED:              "bg-slate-50 text-slate-700",
  CANCELLED:            "bg-slate-100 text-slate-500 line-through",
};

export default async function ClaimsPage({ params, searchParams }: Props) {
  const { companyId } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale  = locale === "en" ? "en-US" : "ar-KW";

  // صلاحيات المستخدم الحالي
  const canCollect = session.isSuperAdmin || hasPermission(session, "INVESTOR_CLAIMS", "COLLECT", { companyId });
  const canAdmin   = session.isSuperAdmin || hasPermission(session, "INVESTOR_CLAIMS", "UPDATE", { companyId });

  const claims = await prisma.investorClaim.findMany({
    where: {
      companyId,
    },
    include: {
      investor: { select: { nameAr: true, nameEn: true, phone: true } },
      branch:   { select: { nameAr: true, nameEn: true } },
      lines: true,
      beneficiaries: { select: { id: true, nameAr: true, nameEn: true, isInvestor: true } },
    },
    orderBy: { claimDate: "desc" },
  });

  type ClaimRow = typeof claims[number];
  type ClaimLineRow = ClaimRow["lines"][number];
  type BeneficiaryRow = ClaimRow["beneficiaries"][number];
  const claimList: ClaimListItem[] = claims.map((claim: ClaimRow) => ({
    id: claim.id, status: claim.status, type: claim.type, description: claim.descriptionAr, notes: claim.notes ?? null,
    investorName: locale === "en" ? claim.investor.nameEn ?? claim.investor.nameAr : claim.investor.nameAr,
    investorPhone: claim.investor.phone ?? null,
    branchName: claim.branch ? (locale === "en" ? claim.branch.nameEn ?? claim.branch.nameAr : claim.branch.nameAr) : (locale === "en" ? "No branch" : "بدون فرع"),
    claimDate: claim.claimDate.toISOString(), dueDate: claim.dueDate?.toISOString() ?? null,
    totalActual: claim.lines.reduce((sum: number, line: ClaimLineRow) => sum + Number(line.actualAmount), 0),
    totalCollected: claim.lines.reduce((sum: number, line: ClaimLineRow) => sum + Number(line.collectedAmount), 0),
    lines: claim.lines.map((line: ClaimLineRow) => ({ id: line.id, descriptionAr: line.descriptionAr, actualAmount: Number(line.actualAmount), collectedAmount: Number(line.collectedAmount) })),
    beneficiaries: claim.beneficiaries.map((beneficiary: BeneficiaryRow) => ({ id: beneficiary.id, name: locale === "en" ? beneficiary.nameEn ?? beneficiary.nameAr : beneficiary.nameAr, isInvestor: beneficiary.isInvestor })),
  }));
  const getTypeLabel = (type: keyof typeof typeLabels.ar) => typeLabels[locale][type];
  const getStatusLabel = (status: keyof typeof statusLabels.ar) => statusLabels[locale][status];

  const filters = [
    "",
    "PENDING",
    "SENT_TO_ACCOUNTANT",
    "SENT_TO_INVESTOR",
    "COLLECTED",
    "COMPLETED",
    "OVERDUE",
    "CANCELLED",
  ] as const;

  return (
    <div>
      <Header
        title={locale === "en" ? "Investor Claims" : "مطالبات المسئولين والمديرين"}
        subtitle={locale === "en" ? "Claims, collections, and renewal workflow" : "سجل المطالبات والتحصيلات والتجديد"}
        companyId={companyId}
        actions={
          canAdmin ? (
            <Link
              href={`/dashboard/companies/${companyId}/investors/claims/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New claim" : "مطالبة جديدة"}
            </Link>
          ) : null
        }
      />

      <div className="page-container space-y-4">
        {/* ── تجديدات مطلوبة ── */}
        <RenewalAlertsPanel companyId={companyId} locale={locale} />

        <ClaimsList
          claims={claimList}
          locale={locale}
          canCollect={canCollect}
          canAdmin={canAdmin}
          initialStatus={query.status}
        />

        {/* ── فلاتر الحالة ── */}
        {false && <>
        <div className="hidden">
          {filters.map((status) => {
            const active = query.status === status || (!query.status && !status);
            const href   = `/dashboard/companies/${companyId}/investors/claims${status ? `?status=${status}` : ""}`;
            const label  = status
              ? statusLabels[locale][status as keyof typeof statusLabels.ar]
              : locale === "en" ? "All" : "الكل";
            return (
              <Link
                key={status}
                href={href}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <div className="hidden overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Investor" : "المسئول والمدير"}</th>
                  <th>{locale === "en" ? "Type" : "النوع"}</th>
                  <th>{locale === "en" ? "Branch" : "الفرع"}</th>
                  <th>{locale === "en" ? "Claim date" : "تاريخ المطالبة"}</th>
                  <th>{locale === "en" ? "Due date" : "تاريخ الاستحقاق"}</th>
                  <th>{locale === "en" ? "Required" : "المبلغ المطلوب"}</th>
                  <th>{locale === "en" ? "Collected" : "المحصل"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th>{locale === "en" ? "Actions" : "الإجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No investor claims found" : "لا توجد مطالبات مسئولين"}
                    </td>
                  </tr>
                ) : (
                  claims.map((claim: ClaimRow) => {
                    const totalActual    = claim.lines.reduce((s: number, l: ClaimLineRow) => s + Number(l.actualAmount), 0);
                    const totalCollected = claim.lines.reduce((s: number, l: ClaimLineRow) => s + Number(l.collectedAmount), 0);
                    const investorName   = locale === "en" ? claim.investor.nameEn ?? claim.investor.nameAr : claim.investor.nameAr;
                    const branchName     = claim.branch
                      ? (locale === "en" ? claim.branch.nameEn ?? claim.branch.nameAr : claim.branch.nameAr)
                      : (locale === "en" ? "No branch" : "بدون فرع");

                    return (
                      <tr key={claim.id} className="align-top hover:bg-muted/30">
                        <td className="font-medium">{investorName}</td>
                        <td>
                          <div className="space-y-1">
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                              {getTypeLabel(claim.type)}
                            </span>
                            {claim.beneficiaries.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {claim.beneficiaries.map((b: BeneficiaryRow) => (
                                  <span
                                    key={b.id}
                                    className={`rounded-full px-1.5 py-0.5 text-xs ${b.isInvestor ? "bg-primary/10 text-primary" : "bg-blue-50 text-blue-700"}`}
                                  >
                                    {locale === "en" ? b.nameEn ?? b.nameAr : b.nameAr}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-sm text-muted-foreground">{branchName}</td>
                        <td className="text-sm">{formatDate(claim.claimDate, dateLocale)}</td>
                        <td className="text-sm">
                          {claim.dueDate ? formatDate(claim.dueDate, dateLocale) : (locale === "en" ? "—" : "—")}
                        </td>
                        <td className="number text-sm">{formatKWD(totalActual, numberLocale)}</td>
                        <td className={`number text-sm font-bold ${totalCollected > 0 ? "text-teal-700" : "text-muted-foreground"}`}>
                          {totalCollected > 0 ? formatKWD(totalCollected, numberLocale) : "—"}
                        </td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[claim.status] ?? "bg-muted text-muted-foreground"}`}>
                            {getStatusLabel(claim.status) ?? claim.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1.5">
                            <ClaimStatusActions
                              claimId={claim.id}
                              status={claim.status}
                              canCollect={canCollect}
                              canAdmin={canAdmin}
                              investorPhone={claim.investor.phone ?? null}
                              investorName={investorName}
                              claimType={claim.type}
                              claimDescription={claim.descriptionAr}
                              claimLines={claim.lines.map((l: ClaimLineRow) => ({
                                id: l.id,
                                descriptionAr: l.descriptionAr,
                                actualAmount: Number(l.actualAmount),
                                collectedAmount: Number(l.collectedAmount),
                              }))}
                              dueDate={claim.dueDate ? formatDate(claim.dueDate, dateLocale) : null}
                              totalActual={totalActual}
                            />
                            <ClaimEditDeleteActions
                              claimId={claim.id}
                              status={claim.status}
                              descriptionAr={claim.descriptionAr}
                              type={claim.type}
                              dueDate={claim.dueDate ? claim.dueDate.toISOString() : null}
                              notes={claim.notes ?? null}
                            />
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
        </>}
      </div>
    </div>
  );
}

// ── لوحة التجديدات المطلوبة ──────────────────────────────────────────────────

const OPEN_STATUSES = ["PENDING", "SENT_TO_ACCOUNTANT", "SENT_TO_INVESTOR", "PARTIALLY_COLLECTED", "COLLECTED", "OVERDUE"];

type RenewalAlert = {
  key: string;
  entityType: "EMPLOYEE" | "LICENSE_DOC";
  nameAr: string;
  nameEn: string | null;
  branchNameAr: string | null;
  branchNameEn: string | null;
  docTypeAr: string;
  docTypeEn: string;
  claimType: "RESIDENCY_RENEWAL" | "LICENSE_RENEWAL";
  expiryDate: Date;
  daysLeft: number;
  existingClaim: { id: string; status: string } | null;
  employeeId?: string;
  newClaimHref: string;
};

const LICENSE_DOC_TYPES = [
  { field: "licenseExpiryDate",          ar: "الرخصة التجارية",      en: "Commercial License",   threshold: 60 },
  { field: "fireLicenseExpiryDate",       ar: "رخصة الدفاع المدني",   en: "Fire Safety License",  threshold: 60 },
  { field: "healthLicenseExpiryDate",     ar: "الرخصة الصحية",        en: "Health License",       threshold: 60 },
  { field: "advertisingLicenseExpiryDate",ar: "رخصة الإعلانات",       en: "Advertising License",  threshold: 60 },
  { field: "trafficCertExpiryDate",       ar: "شهادة المرور",          en: "Traffic Certificate",  threshold: 60 },
  { field: "customsCertExpiryDate",       ar: "شهادة الجمارك",         en: "Customs Certificate",  threshold: 60 },
  { field: "importLicenseExpiryDate",     ar: "رخصة الاستيراد",        en: "Import License",       threshold: 60 },
] as const;

const CLAIM_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  PENDING:             { ar: "معلق",          en: "Pending" },
  SENT_TO_ACCOUNTANT:  { ar: "عند المحاسب",   en: "With accountant" },
  SENT_TO_INVESTOR:    { ar: "عند المسئول",   en: "With investor" },
  PARTIALLY_COLLECTED: { ar: "محصل جزئياً",   en: "Partial" },
  COLLECTED:           { ar: "تم التحصيل",    en: "Collected" },
  OVERDUE:             { ar: "متأخر",          en: "Overdue" },
};

async function RenewalAlertsPanel({
  companyId,
  locale,
}: {
  companyId: string;
  locale: "ar" | "en";
}) {
  const now = new Date();
  const maxDate = new Date(now.getTime() + 90 * 86400000);

  const [residencyEmps, licenseEmps, companyLicenses] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, isActive: true, isDeleted: false, residencyExpiry: { not: null, lte: maxDate } },
      select: { id: true, nameAr: true, nameEn: true, residencyExpiry: true, residencyAlertDays: true, branch: { select: { nameAr: true, nameEn: true } } },
      orderBy: { residencyExpiry: "asc" },
    }),
    prisma.employee.findMany({
      where: { companyId, isActive: true, isDeleted: false, licenseExpiry: { not: null, lte: maxDate } },
      select: { id: true, nameAr: true, nameEn: true, licenseExpiry: true, branch: { select: { nameAr: true, nameEn: true } } },
      orderBy: { licenseExpiry: "asc" },
    }),
    prisma.license.findMany({
      where: {
        companyId,
        status: "ACTIVE",
        OR: LICENSE_DOC_TYPES.map((d) => ({ [d.field]: { not: null, lte: maxDate } })),
      },
      select: {
        id: true,
        commercialNameAr: true,
        commercialNameEn: true,
        licenseExpiryDate: true,
        fireLicenseExpiryDate: true,
        healthLicenseExpiryDate: true,
        advertisingLicenseExpiryDate: true,
        trafficCertExpiryDate: true,
        customsCertExpiryDate: true,
        importLicenseExpiryDate: true,
        branch: { select: { nameAr: true, nameEn: true } },
      },
    }),
  ]);

  type ResidencyEmployeeRow = typeof residencyEmps[number];
  type LicenseEmployeeRow = typeof licenseEmps[number];
  type CompanyLicenseRow = typeof companyLicenses[number];

  // فلتر الموظفين بحدود التنبيه الخاصة بكل منهم
  const residencyAlerts = residencyEmps.filter((e: ResidencyEmployeeRow) => {
    const d = Math.ceil((e.residencyExpiry!.getTime() - now.getTime()) / 86400000);
    return d <= e.residencyAlertDays;
  });
  const empLicenseAlerts = licenseEmps.filter((e: LicenseEmployeeRow) => {
    const d = Math.ceil((e.licenseExpiry!.getTime() - now.getTime()) / 86400000);
    return d <= 60;
  });

  // مطالبات موظفين مفتوحة
  const empIds = [...residencyAlerts.map((e: ResidencyEmployeeRow) => e.id), ...empLicenseAlerts.map((e: LicenseEmployeeRow) => e.id)];
  const openBeneficiaries = empIds.length > 0
    ? await prisma.investorClaimBeneficiary.findMany({
        where: {
          employeeId: { in: empIds },
          claim: { companyId, status: { in: OPEN_STATUSES as never[] }, type: { in: ["RESIDENCY_RENEWAL", "LICENSE_RENEWAL"] } },
        },
        select: { employeeId: true, claim: { select: { id: true, status: true, type: true } } },
      })
    : [];
  type OpenBeneficiaryRow = typeof openBeneficiaries[number];

  const claimMap = new Map<string, { id: string; status: string }>();
  for (const b of openBeneficiaries) {
    if (b.employeeId) claimMap.set(`${b.employeeId}:${b.claim.type}`, { id: b.claim.id, status: b.claim.status });
  }

  // بناء قائمة التنبيهات
  const alerts: RenewalAlert[] = [];

  for (const emp of residencyAlerts) {
    const daysLeft = Math.ceil((emp.residencyExpiry!.getTime() - now.getTime()) / 86400000);
    alerts.push({
      key: `emp:${emp.id}:RESIDENCY`,
      entityType: "EMPLOYEE",
      nameAr: emp.nameAr,
      nameEn: emp.nameEn ?? null,
      branchNameAr: emp.branch?.nameAr ?? null,
      branchNameEn: emp.branch?.nameEn ?? null,
      docTypeAr: "إقامة",
      docTypeEn: "Residency",
      claimType: "RESIDENCY_RENEWAL",
      expiryDate: emp.residencyExpiry!,
      daysLeft,
      existingClaim: claimMap.get(`${emp.id}:RESIDENCY_RENEWAL`) ?? null,
      employeeId: emp.id,
      newClaimHref: `/dashboard/companies/${companyId}/investors/claims/new?type=RESIDENCY_RENEWAL&prefillEmployeeId=${emp.id}&prefillEmployeeNameAr=${encodeURIComponent(emp.nameAr)}${emp.nameEn ? `&prefillEmployeeNameEn=${encodeURIComponent(emp.nameEn)}` : ""}`,
    });
  }

  for (const emp of empLicenseAlerts) {
    const daysLeft = Math.ceil((emp.licenseExpiry!.getTime() - now.getTime()) / 86400000);
    alerts.push({
      key: `emp:${emp.id}:LICENSE`,
      entityType: "EMPLOYEE",
      nameAr: emp.nameAr,
      nameEn: emp.nameEn ?? null,
      branchNameAr: emp.branch?.nameAr ?? null,
      branchNameEn: emp.branch?.nameEn ?? null,
      docTypeAr: "رخصة موظف",
      docTypeEn: "Employee License",
      claimType: "LICENSE_RENEWAL",
      expiryDate: emp.licenseExpiry!,
      daysLeft,
      existingClaim: claimMap.get(`${emp.id}:LICENSE_RENEWAL`) ?? null,
      employeeId: emp.id,
      newClaimHref: `/dashboard/companies/${companyId}/investors/claims/new?type=LICENSE_RENEWAL&prefillEmployeeId=${emp.id}&prefillEmployeeNameAr=${encodeURIComponent(emp.nameAr)}${emp.nameEn ? `&prefillEmployeeNameEn=${encodeURIComponent(emp.nameEn)}` : ""}`,
    });
  }

  for (const lic of companyLicenses) {
    for (const docType of LICENSE_DOC_TYPES) {
      const expiry = (lic as Record<string, unknown>)[docType.field] as Date | null;
      if (!expiry) continue;
      const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
      if (daysLeft > docType.threshold) continue;
      const licName = locale === "en" ? lic.commercialNameEn ?? lic.commercialNameAr : lic.commercialNameAr;
      alerts.push({
        key: `lic:${lic.id}:${docType.field}`,
        entityType: "LICENSE_DOC",
        nameAr: lic.commercialNameAr,
        nameEn: lic.commercialNameEn ?? null,
        branchNameAr: lic.branch?.nameAr ?? null,
        branchNameEn: lic.branch?.nameEn ?? null,
        docTypeAr: docType.ar,
        docTypeEn: docType.en,
        claimType: "LICENSE_RENEWAL",
        expiryDate: expiry,
        daysLeft,
        existingClaim: null,
        newClaimHref: `/dashboard/companies/${companyId}/investors/claims/new?type=LICENSE_RENEWAL&prefillLicenseNameAr=${encodeURIComponent(`${lic.commercialNameAr} — ${docType.ar}`)}`,
      });
      void licName;
    }
  }

  alerts.sort((a, b) => a.daysLeft - b.daysLeft);

  if (alerts.length === 0) return null;

  const urgentCount = alerts.filter((a) => a.daysLeft <= 30 && !a.existingClaim).length;
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-orange-100/60 border-b border-orange-200">
        <AlertTriangle size={16} className="text-orange-600 shrink-0" />
        <span className="font-bold text-sm text-orange-800">
          {locale === "en" ? "Renewals needed" : "تجديدات مطلوبة"}
        </span>
        {urgentCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            {urgentCount} {locale === "en" ? "urgent" : "عاجل"}
          </span>
        )}
        <span className="ms-auto text-xs text-orange-600">
          {alerts.length} {locale === "en" ? "item(s)" : "عنصر"}
        </span>
      </div>

      <div className="divide-y divide-orange-100">
        {alerts.map((alert) => {
          const name = locale === "en" ? alert.nameEn ?? alert.nameAr : alert.nameAr;
          const branch = locale === "en" ? alert.branchNameEn ?? alert.branchNameAr : alert.branchNameAr;
          const docType = locale === "en" ? alert.docTypeEn : alert.docTypeAr;
          const isExpired = alert.daysLeft < 0;
          const isUrgent  = !isExpired && alert.daysLeft <= 30;
          const isWarning = !isExpired && alert.daysLeft > 30 && alert.daysLeft <= 60;

          const daysColor = isExpired ? "text-red-700 font-bold"
            : isUrgent  ? "text-orange-700 font-bold"
            : isWarning ? "text-yellow-700"
            : "text-muted-foreground";

          const tagColor = alert.claimType === "RESIDENCY_RENEWAL"
            ? "bg-blue-100 text-blue-700"
            : alert.entityType === "LICENSE_DOC"
            ? "bg-green-100 text-green-700"
            : "bg-purple-100 text-purple-700";

          return (
            <div key={alert.key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{name}</span>
                  {branch && <span className="text-xs text-muted-foreground">— {branch}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${tagColor}`}>{docType}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {locale === "en" ? "Expires:" : "ينتهي:"}{" "}
                    {alert.expiryDate.toLocaleDateString(dateLocale)}
                  </span>
                  <span className={`text-xs ${daysColor}`}>
                    {isExpired
                      ? `${locale === "en" ? "Expired" : "انتهى منذ"} ${Math.abs(alert.daysLeft)} ${locale === "en" ? "days" : "يوم"}`
                      : `${alert.daysLeft} ${locale === "en" ? "day(s) left" : "يوم متبقي"}`}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {alert.existingClaim ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                    {locale === "en"
                      ? CLAIM_STATUS_LABELS[alert.existingClaim.status]?.en ?? alert.existingClaim.status
                      : CLAIM_STATUS_LABELS[alert.existingClaim.status]?.ar ?? alert.existingClaim.status}
                  </span>
                ) : (
                  <Link
                    href={alert.newClaimHref}
                    className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus size={12} />
                    {locale === "en" ? "Create claim" : "إنشاء مطالبة"}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
