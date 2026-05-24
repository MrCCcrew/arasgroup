import { redirect } from "next/navigation";
import { AlertTriangle, FileText, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { upsertNotification } from "@/lib/notifications";
import Link from "next/link";

interface Props {
  params: Promise<{ companyId: string }>;
}

const EMP_TYPE_LABELS: Record<string, string> = {
  DRIVER: "سائق",
  CAR_WASH_DRIVER: "سائق غسيل",
  CAR_WASH_WORKER: "عامل غسيل",
  OFFICE_EMPLOYEE: "موظف مكتب",
  ACCOUNTANT: "محاسب",
  MANDOUB: "مندوب",
  OFFICE_BOY: "عامل خدمات",
};

const LICENSE_TYPE_LABELS: Record<string, string> = {
  licenseExpiryDate: "الرخصة التجارية",
  fireLicenseExpiryDate: "رخصة الإطفاء",
  healthLicenseExpiryDate: "الرخصة الصحية",
  advertisingLicenseExpiryDate: "رخصة الإعلانات",
};

function urgency(date: Date | null | undefined, now: Date) {
  if (!date) return "none";
  const days = Math.ceil((date.getTime() - now.getTime()) / 864e5);
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 60) return "warning";
  return "ok";
}

function daysLeft(date: Date | null | undefined, now: Date) {
  if (!date) return null;
  return Math.ceil((date.getTime() - now.getTime()) / 864e5);
}

function UrgencyBadge({ date, now }: { date: Date | null | undefined; now: Date }) {
  const days = daysLeft(date, now);
  const level = urgency(date, now);
  if (days === null) return <span className="text-muted-foreground">—</span>;
  const styles =
    level === "expired"  ? "bg-red-100 text-red-700" :
    level === "critical" ? "bg-orange-100 text-orange-700" :
    level === "warning"  ? "bg-yellow-100 text-yellow-700" :
                           "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${styles}`}>
      {level === "expired" ? "منتهية" : `${days} يوم`}
    </span>
  );
}

export default async function ExpiryAlertsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 864e5);

  // ── Employees (residency + license) ──
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      isDeleted: false,
      OR: [
        { residencyExpiry: { lte: in90 } },
        { licenseExpiry: { lte: in90 } },
      ],
    },
    orderBy: { residencyExpiry: "asc" },
  });

  // ── Licenses ──
  const licenses = await prisma.license.findMany({
    where: {
      companyId,
      status: { not: "CANCELLED" },
      OR: [
        { licenseExpiryDate: { lte: in90 } },
        { fireLicenseExpiryDate: { lte: in90 } },
        { healthLicenseExpiryDate: { lte: in90 } },
        { advertisingLicenseExpiryDate: { lte: in90 } },
      ],
    },
    orderBy: { licenseExpiryDate: "asc" },
    select: {
      id: true,
      commercialNameAr: true,
      licenseNumber: true,
      isMainLicense: true,
      licenseExpiryDate: true,
      fireLicenseExpiryDate: true,
      healthLicenseExpiryDate: true,
      advertisingLicenseExpiryDate: true,
    },
  });

  // ── Stat counts ──
  const empExpired  = employees.filter((e) => urgency(e.residencyExpiry, now) === "expired").length;
  const empCritical = employees.filter((e) => urgency(e.residencyExpiry, now) === "critical").length;
  const empWarning  = employees.filter((e) => urgency(e.residencyExpiry, now) === "warning").length;

  const licExpired  = licenses.filter((l) =>
    ["licenseExpiryDate","fireLicenseExpiryDate","healthLicenseExpiryDate","advertisingLicenseExpiryDate"]
      .some((k) => urgency(l[k as keyof typeof l] as Date | null, now) === "expired")
  ).length;
  const licCritical = licenses.filter((l) =>
    ["licenseExpiryDate","fireLicenseExpiryDate","healthLicenseExpiryDate","advertisingLicenseExpiryDate"]
      .some((k) => urgency(l[k as keyof typeof l] as Date | null, now) === "critical")
  ).length;
  const licWarning  = licenses.filter((l) =>
    ["licenseExpiryDate","fireLicenseExpiryDate","healthLicenseExpiryDate","advertisingLicenseExpiryDate"]
      .some((k) => urgency(l[k as keyof typeof l] as Date | null, now) === "warning")
  ).length;

  // ── Auto-notifications for expired residencies ──
  await Promise.all(
    employees
      .filter((e) => e.residencyExpiry && urgency(e.residencyExpiry, now) === "expired")
      .map((e) =>
        upsertNotification({
          type: "RESIDENCY_EXPIRY",
          uniqueKey: `employee:${e.id}:residency:expired:${e.residencyExpiry!.toISOString().slice(0, 10)}`,
          titleAr: "انتهت الإقامة — يرجى التجديد",
          titleEn: "Residency expired — renewal required",
          messageAr: `انتهت إقامة الموظف ${e.nameAr} — يرجى التجديد أو تحديث البيانات`,
          messageEn: `Residency for ${e.nameEn ?? e.nameAr} has expired — please renew or update data`,
          companyId: e.companyId,
          branchId: e.branchId ?? undefined,
          employeeId: e.id,
          entityType: "EMPLOYEE",
          entityId: e.id,
          dueDate: e.residencyExpiry,
          severity: "DANGER",
          targetRole: "ADMINISTRATIVE_AFFAIRS",
          refModule: "hr",
          refId: e.id,
        }),
      ),
  );

  return (
    <div>
      <Header
        title="تنبيهات الانتهاء"
        subtitle="إقامات وتراخيص ورخص تنتهي قريباً"
        companyId={companyId}
      />

      <div className="page-container space-y-6">

        {/* ══ EMPLOYEES section ══ */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-orange-500" />
            <h2 className="text-base font-bold">الموظفون والعمال</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "منتهية الآن",   count: empExpired,  color: "red"    },
              { label: "خلال 30 يوم",   count: empCritical, color: "orange" },
              { label: "خلال 60 يوم",   count: empWarning,  color: "yellow" },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${s.color}-50`}>
                  <AlertTriangle size={18} className={`text-${s.color}-500`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="section-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="ar-table text-sm">
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الوظيفة</th>
                    <th>انتهاء الإقامة</th>
                    <th>الأيام المتبقية</th>
                    <th>انتهاء الرخصة</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        لا توجد انتهاءات قريبة للموظفين
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-muted/20">
                        <td>
                          <Link
                            href={`/dashboard/companies/${companyId}/hr/employees/${emp.id}`}
                            className="font-medium hover:underline"
                          >
                            {emp.nameAr}
                          </Link>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {EMP_TYPE_LABELS[emp.type] ?? emp.type}
                        </td>
                        <td className="number text-sm">
                          {emp.residencyExpiry ? formatDate(emp.residencyExpiry, numberLocale) : "—"}
                        </td>
                        <td>
                          <UrgencyBadge date={emp.residencyExpiry} now={now} />
                        </td>
                        <td className="number text-sm">
                          {emp.licenseExpiry ? formatDate(emp.licenseExpiry, numberLocale) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ══ LICENSES section ══ */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-500" />
            <h2 className="text-base font-bold">التراخيص</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "منتهية الآن",   count: licExpired,  color: "red"    },
              { label: "خلال 30 يوم",   count: licCritical, color: "orange" },
              { label: "خلال 60 يوم",   count: licWarning,  color: "yellow" },
            ].map((s) => (
              <div key={s.label} className="stat-card">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${s.color}-50`}>
                  <AlertTriangle size={18} className={`text-${s.color}-500`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="section-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="ar-table text-sm">
                <thead>
                  <tr>
                    <th>الاسم التجاري</th>
                    <th>رقم الرخصة</th>
                    <th>نوع الرخصة</th>
                    <th>تاريخ الانتهاء</th>
                    <th>الأيام المتبقية</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        لا توجد تراخيص منتهية أو قريبة من الانتهاء
                      </td>
                    </tr>
                  ) : (
                    licenses.flatMap((lic) =>
                      (
                        [
                          "licenseExpiryDate",
                          "fireLicenseExpiryDate",
                          "healthLicenseExpiryDate",
                          "advertisingLicenseExpiryDate",
                        ] as const
                      )
                        .filter((k) => {
                          const d = lic[k] as Date | null;
                          return d && d <= in90;
                        })
                        .map((k) => {
                          const d = lic[k] as Date;
                          return (
                            <tr key={`${lic.id}-${k}`} className="hover:bg-muted/20">
                              <td>
                                <Link
                                  href={`/dashboard/companies/${companyId}/licenses/${lic.id}`}
                                  className="font-medium hover:underline"
                                >
                                  {lic.commercialNameAr}
                                </Link>
                                {!lic.isMainLicense && (
                                  <span className="mr-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                    فرعي
                                  </span>
                                )}
                              </td>
                              <td className="font-mono text-xs">{lic.licenseNumber}</td>
                              <td className="text-sm">
                                {LICENSE_TYPE_LABELS[k] ?? k}
                              </td>
                              <td className="number text-sm">
                                {formatDate(d, numberLocale)}
                              </td>
                              <td>
                                <UrgencyBadge date={d} now={now} />
                              </td>
                            </tr>
                          );
                        }),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
