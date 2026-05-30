import { prisma } from "@/lib/db";
import { getAccessibleBranchIds, hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/types";
import type { AlertCategory, ExpiryAlertItem } from "./shared";

export type AlertLocale = "ar" | "en";

const EMPLOYEE_VEHICLE_WINDOW_DAYS = 60;
const LICENSE_WINDOW_DAYS = 90;

// مسميات أنواع الموظفين (عربي/إنجليزي) — تستخدم في عمود التفصيل بدل عرض الـ enum الخام
const EMPLOYEE_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  DRIVER: { ar: "سائق", en: "Driver" },
  DELIVERY_DRIVER: { ar: "سائق توصيل", en: "Delivery Driver" },
  DELIVERY_ADMIN: { ar: "إداري توصيل", en: "Delivery Admin" },
  CAR_WASH_DRIVER: { ar: "سائق غسيل", en: "Car Wash Driver" },
  CAR_WASH_WORKER: { ar: "عامل غسيل", en: "Car Wash Worker" },
  OFFICE_EMPLOYEE: { ar: "موظف مكتب", en: "Office Employee" },
  ACCOUNTANT: { ar: "محاسب", en: "Accountant" },
  MANDOUB: { ar: "مندوب", en: "Mandoub" },
  OFFICE_BOY: { ar: "عامل خدمات", en: "Office Boy" },
  OTHER: { ar: "أخرى", en: "Other" },
};

type EmployeeAlertRow = {
  id: string;
  nameAr: string;
  type: string;
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
  licenseExpiryDate: Date | null;
  fireLicenseExpiryDate: Date | null;
  healthLicenseExpiryDate: Date | null;
  advertisingLicenseExpiryDate: Date | null;
  trafficCertExpiryDate: Date | null;
  customsCertExpiryDate: Date | null;
  importLicenseExpiryDate: Date | null;
};

type TypeDef<R> = { key: keyof R; ar: string; en: string };

const EMPLOYEE_TYPES: Array<TypeDef<EmployeeAlertRow>> = [
  { key: "residencyExpiry", ar: "انتهاء الإقامة", en: "Residency expiry" },
  { key: "licenseExpiry", ar: "انتهاء رخصة القيادة", en: "Driving license expiry" },
  { key: "healthCardExpiryDate", ar: "انتهاء كارت الصحة", en: "Health card expiry" },
  { key: "passportExpiryDate", ar: "انتهاء جواز السفر", en: "Passport expiry" },
  { key: "municipalityCardExpiryDate", ar: "انتهاء بطاقة البلدية", en: "Municipality card expiry" },
  { key: "visaExpiryDate", ar: "انتهاء الفيزا", en: "Visa expiry" },
];

const VEHICLE_TYPES: Array<TypeDef<VehicleAlertRow>> = [
  { key: "insuranceExpiry", ar: "انتهاء التأمين", en: "Insurance expiry" },
  { key: "insuranceExpiryDate", ar: "انتهاء التأمين", en: "Insurance expiry" },
  { key: "registrationExpiry", ar: "انتهاء التسجيل", en: "Registration expiry" },
  { key: "municipalityCardExpiryDate", ar: "انتهاء بطاقة البلدية", en: "Municipality card expiry" },
  { key: "advertisingCardExpiryDate", ar: "انتهاء بطاقة الإعلان", en: "Advertising card expiry" },
  { key: "foodLicenseExpiryDate", ar: "انتهاء الترخيص الصحي للمركبة", en: "Vehicle food license expiry" },
];

const LICENSE_TYPES: Array<TypeDef<LicenseAlertRow>> = [
  { key: "licenseExpiryDate", ar: "انتهاء الرخصة التجارية", en: "Commercial license expiry" },
  { key: "fireLicenseExpiryDate", ar: "انتهاء رخصة الإطفاء", en: "Fire license expiry" },
  { key: "healthLicenseExpiryDate", ar: "انتهاء الرخصة الصحية", en: "Health license expiry" },
  { key: "advertisingLicenseExpiryDate", ar: "انتهاء رخصة الإعلانات", en: "Advertising license expiry" },
  { key: "trafficCertExpiryDate", ar: "انتهاء شهادة المرور", en: "Traffic certificate expiry" },
  { key: "customsCertExpiryDate", ar: "انتهاء الشهادة الجمركية", en: "Customs certificate expiry" },
  { key: "importLicenseExpiryDate", ar: "انتهاء رخصة الاستيراد", en: "Import license expiry" },
];

function daysLeft(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / 864e5);
}

function ensureDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dedupeAlerts(alerts: ExpiryAlertItem[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = [alert.category, alert.entityId, alert.expiryType, alert.expiryDate.slice(0, 10)].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeAlert(
  category: AlertCategory,
  entityId: string,
  title: string,
  subtitle: string,
  expiryType: string,
  expiryDate: Date,
  now: Date,
  href: string,
): ExpiryAlertItem {
  return {
    id: `${category}-${entityId}-${expiryType}-${expiryDate.toISOString().slice(0, 10)}`,
    category,
    entityId,
    title,
    subtitle,
    expiryType,
    expiryDate: expiryDate.toISOString(),
    daysLeft: daysLeft(expiryDate, now),
    href,
  };
}

export async function getExpiryAlertsData(session: SessionUser, companyId: string, locale: AlertLocale = "ar") {
  const en = locale === "en";
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
            type: true,
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

  const employeeAlerts = dedupeAlerts(
    employees.flatMap((employee) =>
      EMPLOYEE_TYPES.flatMap(({ key, ar, en: enLabel }) => {
        const date = employee[key];
        if (!date || date > in60) return [];
        const expiryDate = ensureDate(date);
        const typeLabel = EMPLOYEE_TYPE_LABELS[employee.type]?.[locale] ?? employee.type;
        return [
          makeAlert(
            "employee",
            employee.id,
            employee.nameAr,
            typeLabel,
            en ? enLabel : ar,
            expiryDate,
            now,
            canUpdateEmployees
              ? `/dashboard/companies/${companyId}/hr/employees/${employee.id}/edit`
              : `/dashboard/companies/${companyId}/hr/employees/${employee.id}`,
          ),
        ];
      }),
    ),
  );

  const vehicleAlerts = dedupeAlerts(
    vehicles.flatMap((vehicle) =>
      VEHICLE_TYPES.flatMap(({ key, ar, en: enLabel }) => {
        const date = vehicle[key];
        if (!date || date > in60) return [];
        const expiryDate = ensureDate(date);
        const description = [
          vehicle.vehicleNumber ?? (en ? "No number" : "بدون رقم"),
          [vehicle.make, vehicle.model].filter(Boolean).join(" ") || (en ? "No model" : "بدون موديل"),
        ].join(" • ");
        return [
          makeAlert(
            "vehicle",
            vehicle.id,
            vehicle.plateNumber,
            description,
            en ? enLabel : ar,
            expiryDate,
            now,
            canUpdateVehicles
              ? `/dashboard/companies/${companyId}/vehicles?edit=${vehicle.id}`
              : `/dashboard/companies/${companyId}/vehicles/${vehicle.id}`,
          ),
        ];
      }),
    ),
  );

  const licenseAlerts = dedupeAlerts(
    licenses.flatMap((license) =>
      LICENSE_TYPES.flatMap(({ key, ar, en: enLabel }) => {
        const date = license[key];
        if (!date || date > in90) return [];
        const expiryDate = ensureDate(date);
        return [
          makeAlert(
            "license",
            license.id,
            license.commercialNameAr,
            en ? `License no: ${license.licenseNumber}` : `رقم الترخيص: ${license.licenseNumber}`,
            en ? enLabel : ar,
            expiryDate,
            now,
            `/dashboard/companies/${companyId}/licenses/${license.id}`,
          ),
        ];
      }),
    ),
  );

  return [...employeeAlerts, ...vehicleAlerts, ...licenseAlerts].sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}
