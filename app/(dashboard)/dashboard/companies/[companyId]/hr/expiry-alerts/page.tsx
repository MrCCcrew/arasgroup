import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Car, FileText, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { getAccessibleBranchIds, hasPermission } from "@/lib/auth/permissions";

interface Props {
  params: Promise<{ companyId: string }>;
}

type AlertCategory = "employee" | "vehicle" | "license";

type ExpiryAlert = {
  id: string;
  category: AlertCategory;
  entityId: string;
  title: string;
  subtitle: string;
  expiryType: string;
  expiryDate: Date;
  daysLeft: number;
  href: string;
};

const EMPLOYEE_VEHICLE_WINDOW_DAYS = 60;
const LICENSE_WINDOW_DAYS = 90;
const EMPLOYEE_TYPES: Array<{
  key: keyof EmployeeAlertRow;
  label: string;
}> = [
  { key: "residencyExpiry", label: "انتهاء الإقامة" },
  { key: "licenseExpiry", label: "انتهاء رخصة القيادة" },
  { key: "healthCardExpiryDate", label: "انتهاء كارت الصحة" },
  { key: "passportExpiryDate", label: "انتهاء جواز السفر" },
  { key: "municipalityCardExpiryDate", label: "انتهاء بطاقة البلدية" },
  { key: "visaExpiryDate", label: "انتهاء الفيزا" },
];

const VEHICLE_TYPES: Array<{
  key: keyof VehicleAlertRow;
  label: string;
}> = [
  { key: "insuranceExpiry", label: "انتهاء التأمين" },
  { key: "insuranceExpiryDate", label: "انتهاء التأمين" },
  { key: "registrationExpiry", label: "انتهاء التسجيل" },
  { key: "municipalityCardExpiryDate", label: "انتهاء بطاقة البلدية" },
  { key: "advertisingCardExpiryDate", label: "انتهاء بطاقة الإعلان" },
  { key: "foodLicenseExpiryDate", label: "انتهاء الترخيص الصحي للمركبة" },
];

const LICENSE_TYPES: Array<{
  key: keyof LicenseAlertRow;
  label: string;
}> = [
  { key: "licenseExpiryDate", label: "انتهاء الرخصة التجارية" },
  { key: "fireLicenseExpiryDate", label: "انتهاء رخصة الإطفاء" },
  { key: "healthLicenseExpiryDate", label: "انتهاء الرخصة الصحية" },
  { key: "advertisingLicenseExpiryDate", label: "انتهاء رخصة الإعلانات" },
  { key: "trafficCertExpiryDate", label: "انتهاء شهادة المرور" },
  { key: "customsCertExpiryDate", label: "انتهاء الشهادة الجمركية" },
  { key: "importLicenseExpiryDate", label: "انتهاء رخصة الاستيراد" },
];

type EmployeeAlertRow = {
  id: string;
  nameAr: string;
  nameEn: string | null;
  type: string;
  branchId: string | null;
  residencyExpiry: Date | null;
  licenseExpiry: Date | null;
  healthCardExpiryDate: Date | null;
  passportExpiryDate: Date | null;
  municipalityCardExpiryDate: Date | null;
  visaExpiryDate: Date | null;
};

type VehicleAlertRow = {
  id: string;
  plateNumber: string;
  vehicleNumber: string | null;
  make: string | null;
  model: string | null;
  branchId: string | null;
  insuranceExpiry: Date | null;
  insuranceExpiryDate: Date | null;
  registrationExpiry: Date | null;
  municipalityCardExpiryDate: Date | null;
  advertisingCardExpiryDate: Date | null;
  foodLicenseExpiryDate: Date | null;
};

type LicenseAlertRow = {
  id: string;
  commercialNameAr: string;
  licenseNumber: string;
  branchId: string | null;
  licenseExpiryDate: Date | null;
  fireLicenseExpiryDate: Date | null;
  healthLicenseExpiryDate: Date | null;
  advertisingLicenseExpiryDate: Date | null;
  trafficCertExpiryDate: Date | null;
  customsCertExpiryDate: Date | null;
  importLicenseExpiryDate: Date | null;
};

function daysLeft(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / 864e5);
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dedupeAlerts(alerts: ExpiryAlert[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = [
      alert.category,
      alert.entityId,
      alert.expiryType,
      alert.expiryDate.toISOString().slice(0, 10),
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function severity(days: number) {
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 60) return "warning";
  return "upcoming";
}

function buildStats(alerts: ExpiryAlert[]) {
  return alerts.reduce(
    (acc, alert) => {
      const level = severity(alert.daysLeft);
      if (level === "expired") acc.expired += 1;
      else if (level === "critical") acc.in30 += 1;
      else if (level === "warning") acc.in60 += 1;
      else acc.in90 += 1;
      return acc;
    },
    { expired: 0, in30: 0, in60: 0, in90: 0 },
  );
}

function StatCard({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "red" | "orange" | "yellow" | "blue";
}) {
  const toneClasses = {
    red: "bg-red-50 text-red-500",
    orange: "bg-orange-50 text-orange-500",
    yellow: "bg-yellow-50 text-yellow-500",
    blue: "bg-blue-50 text-blue-500",
  }[tone];

  return (
    <div className="stat-card">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
        <AlertTriangle size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Badge({ days }: { days: number }) {
  const level = severity(days);
  const classes =
    level === "expired"
      ? "bg-red-100 text-red-700"
      : level === "critical"
        ? "bg-orange-100 text-orange-700"
        : level === "warning"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-blue-100 text-blue-700";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${classes}`}>
      {level === "expired" ? "منتهي" : `${days} يوم`}
    </span>
  );
}

function AlertsTable({
  alerts,
  numberLocale,
}: {
  alerts: ExpiryAlert[];
  numberLocale: string;
}) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        لا توجد عناصر منتهية أو قريبة من الانتهاء ضمن الصلاحيات الحالية
      </div>
    );
  }

  return (
    <div className="section-card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="ar-table text-sm">
          <thead>
            <tr>
              <th>القسم</th>
              <th>العنصر</th>
              <th>التفصيل</th>
              <th>نوع الانتهاء</th>
              <th>تاريخ الانتهاء</th>
              <th>الحالة</th>
              <th>الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="hover:bg-muted/20">
                <td>
                  <span className="text-xs font-medium text-muted-foreground">
                    {alert.category === "employee"
                      ? "الموظفون"
                      : alert.category === "vehicle"
                        ? "المركبات"
                        : "التراخيص"}
                  </span>
                </td>
                <td className="font-medium">{alert.title}</td>
                <td className="text-sm text-muted-foreground">{alert.subtitle}</td>
                <td>{alert.expiryType}</td>
                <td className="number">{formatDate(alert.expiryDate, numberLocale)}</td>
                <td>
                  <Badge days={alert.daysLeft} />
                </td>
                <td>
                  <Link href={alert.href} className="text-primary hover:underline">
                    تحديث البيانات
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function ExpiryAlertsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const branchIds = getAccessibleBranchIds(session, companyId);
  const now = new Date();
  const in60 = new Date(now.getTime() + EMPLOYEE_VEHICLE_WINDOW_DAYS * 864e5);
  const in90 = new Date(now.getTime() + LICENSE_WINDOW_DAYS * 864e5);

  const canViewEmployees =
    hasPermission(session, "HR", "VIEW", { companyId }) ||
    hasPermission(session, "DELIVERY_HR", "VIEW", { companyId }) ||
    hasPermission(session, "CAR_WASH_HR", "VIEW", { companyId });
  const canUpdateEmployees =
    hasPermission(session, "HR", "UPDATE", { companyId }) ||
    hasPermission(session, "DELIVERY_HR", "UPDATE", { companyId }) ||
    hasPermission(session, "CAR_WASH_HR", "UPDATE", { companyId });
  const canViewVehicles = hasPermission(session, "VEHICLES", "VIEW", { companyId });
  const canUpdateVehicles = hasPermission(session, "VEHICLES", "UPDATE", { companyId });
  const canViewLicenses = hasPermission(session, "LICENSES", "VIEW", { companyId });

  const employeeWhere =
    branchIds.length > 0 ? { companyId, branchId: { in: branchIds }, isActive: true, isDeleted: false } : { companyId, isActive: true, isDeleted: false };
  const vehicleWhere =
    branchIds.length > 0 ? { companyId, branchId: { in: branchIds }, isActive: true } : { companyId, isActive: true };
  const licenseWhere =
    branchIds.length > 0
      ? { companyId, branchId: { in: branchIds }, status: { not: "CANCELLED" } }
      : { companyId, status: { not: "CANCELLED" } };

  const [employees, vehicles, licenses] = await Promise.all([
    canViewEmployees
      ? prisma.employee.findMany({
          where: employeeWhere,
          select: {
            id: true,
            nameAr: true,
            nameEn: true,
            type: true,
            branchId: true,
            residencyExpiry: true,
            licenseExpiry: true,
            healthCardExpiryDate: true,
            passportExpiryDate: true,
            municipalityCardExpiryDate: true,
            visaExpiryDate: true,
          },
          orderBy: { nameAr: "asc" },
        })
      : Promise.resolve([] as EmployeeAlertRow[]),
    canViewVehicles
      ? prisma.vehicle.findMany({
          where: vehicleWhere,
          select: {
            id: true,
            plateNumber: true,
            vehicleNumber: true,
            make: true,
            model: true,
            branchId: true,
            insuranceExpiry: true,
            insuranceExpiryDate: true,
            registrationExpiry: true,
            municipalityCardExpiryDate: true,
            advertisingCardExpiryDate: true,
            foodLicenseExpiryDate: true,
          },
          orderBy: { plateNumber: "asc" },
        })
      : Promise.resolve([] as VehicleAlertRow[]),
    canViewLicenses
      ? prisma.license.findMany({
          where: licenseWhere,
          select: {
            id: true,
            commercialNameAr: true,
            licenseNumber: true,
            branchId: true,
            licenseExpiryDate: true,
            fireLicenseExpiryDate: true,
            healthLicenseExpiryDate: true,
            advertisingLicenseExpiryDate: true,
            trafficCertExpiryDate: true,
            customsCertExpiryDate: true,
            importLicenseExpiryDate: true,
          },
          orderBy: { commercialNameAr: "asc" },
        })
      : Promise.resolve([] as LicenseAlertRow[]),
  ]);

  const employeeAlerts = dedupeAlerts(employees.flatMap((employee) =>
    EMPLOYEE_TYPES.flatMap(({ key, label }) => {
      const date = employee[key];
      if (!date || date > in60) return [];
      const expiryDate = asDate(date);
      const left = daysLeft(expiryDate, now);
      return [
        {
          id: `employee-${employee.id}-${key}`,
          category: "employee" as const,
          entityId: employee.id,
          title: employee.nameAr,
          subtitle: employee.type,
          expiryType: label,
          expiryDate,
          daysLeft: left,
          href: canUpdateEmployees
            ? `/dashboard/companies/${companyId}/hr/employees/${employee.id}/edit`
            : `/dashboard/companies/${companyId}/hr/employees/${employee.id}`,
        },
      ];
    }),
  ));

  const vehicleAlerts = dedupeAlerts(vehicles.flatMap((vehicle) =>
    VEHICLE_TYPES.flatMap(({ key, label }) => {
      const date = vehicle[key];
      if (!date || date > in60) return [];
      const expiryDate = asDate(date);
      const left = daysLeft(expiryDate, now);
      const description = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "بدون موديل";
      return [
        {
          id: `vehicle-${vehicle.id}-${key}`,
          category: "vehicle" as const,
          entityId: vehicle.id,
          title: vehicle.plateNumber,
          subtitle: `${vehicle.vehicleNumber ?? "بدون رقم"} • ${description}`,
          expiryType: label,
          expiryDate,
          daysLeft: left,
          href: canUpdateVehicles
            ? `/dashboard/companies/${companyId}/vehicles?edit=${vehicle.id}`
            : `/dashboard/companies/${companyId}/vehicles/${vehicle.id}`,
        },
      ];
    }),
  ));

  const licenseAlerts = dedupeAlerts(licenses.flatMap((license) =>
    LICENSE_TYPES.flatMap(({ key, label }) => {
      const date = license[key];
      if (!date || date > in90) return [];
      const expiryDate = asDate(date);
      const left = daysLeft(expiryDate, now);
      return [
        {
          id: `license-${license.id}-${key}`,
          category: "license" as const,
          entityId: license.id,
          title: license.commercialNameAr,
          subtitle: `رقم الترخيص: ${license.licenseNumber}`,
          expiryType: label,
          expiryDate,
          daysLeft: left,
          href: `/dashboard/companies/${companyId}/licenses/${license.id}`,
        },
      ];
    }),
  ));

  const allAlerts = [...employeeAlerts, ...vehicleAlerts, ...licenseAlerts].sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return a.expiryDate.getTime() - b.expiryDate.getTime();
  });
  const stats = buildStats(allAlerts);

  return (
    <div>
      <Header
        title="تنبيهات الانتهاء"
        subtitle="كل ما سينتهي قريبًا للموظفين والمركبات والتراخيص بحسب صلاحياتك"
        companyId={companyId}
      />

      <div className="page-container space-y-6">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="منتهية الآن" count={stats.expired} tone="red" />
          <StatCard label="خلال 30 يوم" count={stats.in30} tone="orange" />
          <StatCard label="خلال 60 يوم" count={stats.in60} tone="yellow" />
          <StatCard label="خلال 90 يوم للتراخيص" count={stats.in90} tone="blue" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Users size={18} className="text-orange-500" />
              <h2 className="font-bold">الموظفون</h2>
            </div>
            <p className="text-2xl font-bold">{employeeAlerts.length}</p>
            <p className="text-xs text-muted-foreground">إقامات وجوازات ورخص وكروت صحة وبطاقات بلدية وفيزا</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Car size={18} className="text-blue-500" />
              <h2 className="font-bold">المركبات</h2>
            </div>
            <p className="text-2xl font-bold">{vehicleAlerts.length}</p>
            <p className="text-xs text-muted-foreground">تأمين وتسجيل وبطاقات بلدية وإعلان وتراخيص صحية للمركبات</p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <FileText size={18} className="text-amber-500" />
              <h2 className="font-bold">التراخيص</h2>
            </div>
            <p className="text-2xl font-bold">{licenseAlerts.length}</p>
            <p className="text-xs text-muted-foreground">تجارية وإطفاء وصحية وإعلانات ومرور وجمارك واستيراد</p>
          </div>
        </div>

        <AlertsTable alerts={allAlerts} numberLocale={numberLocale} />
      </div>
    </div>
  );
}
