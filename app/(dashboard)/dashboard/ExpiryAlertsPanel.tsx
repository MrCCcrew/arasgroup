import { prisma } from "@/lib/db";
import { workInjuryQuarterExpiryDate } from "@/lib/licenses/work-injury";
import { ExpiryAlertsPanelClient } from "./ExpiryAlertsPanelClient";

interface Props {
  companyIds: string[];
}

export interface AlertItem {
  key: string;
  entityLabel: string;
  expiryLabel: string;
  daysLeft: number;
  companyId: string;
  companyName: string;
  href: string;
  category: "license" | "employee" | "vehicle";
  linkedLicense?: string | null;
  responsibleName?: string | null;
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function formatLicenseSummary(name?: string | null, number?: string | null) {
  if (name && number) return `${name} - ${number}`;
  return name ?? number ?? null;
}

export interface ExpiryAlertTotals {
  danger: number;
  warning: number;
  notice: number;
}

/** Loads and sorts the expiry alerts. Shared by the classic and the modern dashboard. */
export async function getExpiryAlerts(companyIds: string[]): Promise<{ alerts: AlertItem[]; totals: ExpiryAlertTotals } | null> {
  if (companyIds.length === 0) return null;

  const now = new Date();
  const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const [licenses, workInjuryInsurances] = await Promise.all([
  prisma.license.findMany({
    where: {
      companyId: { in: companyIds },
      status: { not: "CANCELLED" },
      OR: [
        { licenseExpiryDate: { lte: in90, gte: now } },
        { fireLicenseExpiryDate: { lte: in90, gte: now } },
        { healthLicenseExpiryDate: { lte: in90, gte: now } },
        { chamberOfCommerceExpiryDate: { lte: in90, gte: now } },
        { advertisingLicenseExpiryDate: { lte: in90, gte: now } },
        { trafficCertExpiryDate: { lte: in90, gte: now } },
        { customsCertExpiryDate: { lte: in90, gte: now } },
        { importLicenseExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true,
      commercialNameAr: true,
      companyId: true,
      licenseNumber: true,
      managerName: true,
      ownerOrInvestorNameAr: true,
      licenseExpiryDate: true,
      fireLicenseExpiryDate: true,
      healthLicenseExpiryDate: true,
      chamberOfCommerceExpiryDate: true,
      advertisingLicenseExpiryDate: true,
      trafficCertExpiryDate: true,
      customsCertExpiryDate: true,
      importLicenseExpiryDate: true,
      company: { select: { nameAr: true } },
    },
  }),
  prisma.workInjuryInsurance.findMany({
    where: { license: { companyId: { in: companyIds }, status: { not: "CANCELLED" } } },
    select: { id: true, year: true, quarter: true, endDate: true, license: { select: { id: true, companyId: true, commercialNameAr: true, licenseNumber: true, managerName: true, ownerOrInvestorNameAr: true, company: { select: { nameAr: true } } } } },
  }),
  ]);

  const employees = await prisma.employee.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      companyId: { in: companyIds },
      OR: [
        { residencyExpiry: { lte: in90, gte: now } },
        { passportExpiryDate: { lte: in90, gte: now } },
        { licenseExpiry: { lte: in90, gte: now } },
        { healthCardExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true,
      nameAr: true,
      companyId: true,
      residencyExpiry: true,
      passportExpiryDate: true,
      licenseExpiry: true,
      healthCardExpiryDate: true,
      company: { select: { nameAr: true } },
      license: { select: { commercialNameAr: true, licenseNumber: true, managerName: true } },
    },
  });

  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      companyId: { in: companyIds },
      OR: [
        { registrationExpiry: { lte: in90, gte: now } },
        { insuranceExpiryDate: { lte: in90, gte: now } },
        { insuranceExpiry: { lte: in90, gte: now } },
        { municipalityCardExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true,
      plateNumber: true,
      companyId: true,
      registrationExpiry: true,
      insuranceExpiryDate: true,
      insuranceExpiry: true,
      municipalityCardExpiryDate: true,
      company: { select: { nameAr: true } },
      license: { select: { commercialNameAr: true, licenseNumber: true } },
      assignedEmployee: { select: { nameAr: true } },
    },
  });

  const alerts: AlertItem[] = [];

  for (const lic of licenses) {
    const rows = [
      { date: lic.licenseExpiryDate, label: "رخصة تجارية" },
      { date: lic.fireLicenseExpiryDate, label: "رخصة إطفاء" },
      { date: lic.healthLicenseExpiryDate, label: "ترخيص صحي" },
      { date: lic.chamberOfCommerceExpiryDate, label: "شهادة غرفة التجارة" },
      { date: lic.advertisingLicenseExpiryDate, label: "رخصة إعلانات" },
      { date: lic.trafficCertExpiryDate, label: "\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u0631\u0648\u0631" },
      { date: lic.customsCertExpiryDate, label: "\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u062c\u0645\u0627\u0631\u0643" },
      { date: lic.importLicenseExpiryDate, label: "\u062a\u0631\u062e\u064a\u0635 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f" },
    ];

    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `lic-${lic.id}-${row.label}-${row.date.toISOString()}`,
          entityLabel: lic.commercialNameAr,
          expiryLabel: row.label,
          daysLeft: daysUntil(row.date),
          companyId: lic.companyId,
          companyName: lic.company.nameAr,
          href: `/dashboard/companies/${lic.companyId}/licenses/${lic.id}`,
          category: "license",
          linkedLicense: lic.licenseNumber,
          responsibleName: lic.managerName ?? lic.ownerOrInvestorNameAr,
        });
      }
    }
  }

  const latestWorkInjuryByLicense = new Map<string, typeof workInjuryInsurances[number]>();
  for (const insurance of workInjuryInsurances) {
    const current = latestWorkInjuryByLicense.get(insurance.license.id);
    if (!current || insurance.year > current.year || (insurance.year === current.year && insurance.quarter > current.quarter)) {
      latestWorkInjuryByLicense.set(insurance.license.id, insurance);
    }
  }
  for (const insurance of latestWorkInjuryByLicense.values()) {
    const lic = insurance.license;
    const quarterExpiry = workInjuryQuarterExpiryDate(insurance.year, insurance.quarter);
    if (quarterExpiry >= now && quarterExpiry <= in90) {
      alerts.push({
        key: `work-injury-quarter-${insurance.id}-${quarterExpiry.toISOString()}`,
      entityLabel: lic.commercialNameAr,
        expiryLabel: `\u0633\u062c\u0644 \u0631\u0628\u0639 \u0627\u0644\u0625\u0635\u0627\u0628\u0627\u062a \u2014 ${insurance.year} Q${insurance.quarter}`,
        daysLeft: daysUntil(quarterExpiry),
      companyId: lic.companyId,
      companyName: lic.company.nameAr,
      href: `/dashboard/companies/${lic.companyId}/licenses/${lic.id}`,
      category: "license",
      linkedLicense: lic.licenseNumber,
      responsibleName: lic.managerName ?? lic.ownerOrInvestorNameAr,
    });
    }
    if (insurance.endDate && insurance.endDate >= now && insurance.endDate <= in90) {
      alerts.push({
        key: `work-injury-certificate-${insurance.id}-${insurance.endDate.toISOString()}`,
        entityLabel: lic.commercialNameAr,
        expiryLabel: `\u0634\u0647\u0627\u062f\u0629 \u062a\u0623\u0645\u064a\u0646 \u0625\u0635\u0627\u0628\u0627\u062a \u0627\u0644\u0639\u0645\u0644`,
        daysLeft: daysUntil(insurance.endDate), companyId: lic.companyId, companyName: lic.company.nameAr,
        href: `/dashboard/companies/${lic.companyId}/licenses/${lic.id}`, category: "license",
        linkedLicense: lic.licenseNumber, responsibleName: lic.managerName ?? lic.ownerOrInvestorNameAr,
      });
    }
  }

  for (const emp of employees) {
    const rows = [
      { date: emp.residencyExpiry, label: "إقامة" },
      { date: emp.passportExpiryDate, label: "جواز سفر" },
      { date: emp.licenseExpiry, label: "رخصة قيادة" },
      { date: emp.healthCardExpiryDate, label: "بطاقة صحية" },
    ];

    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `emp-${emp.id}-${row.label}-${row.date.toISOString()}`,
          entityLabel: emp.nameAr,
          expiryLabel: row.label,
          daysLeft: daysUntil(row.date),
          companyId: emp.companyId,
          companyName: emp.company.nameAr,
          href: `/dashboard/companies/${emp.companyId}/hr/employees/${emp.id}`,
          category: "employee",
          linkedLicense: formatLicenseSummary(emp.license?.commercialNameAr, emp.license?.licenseNumber),
          responsibleName: emp.license?.managerName ?? null,
        });
      }
    }
  }

  for (const veh of vehicles) {
    const insuranceDate = veh.insuranceExpiryDate ?? veh.insuranceExpiry;
    const rows = [
      { date: veh.registrationExpiry, label: "تسجيل مركبة" },
      { date: insuranceDate, label: "تأمين مركبة" },
      { date: veh.municipalityCardExpiryDate, label: "بطاقة بلدية" },
    ];

    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `veh-${veh.id}-${row.label}-${row.date.toISOString()}`,
          entityLabel: veh.plateNumber,
          expiryLabel: row.label,
          daysLeft: daysUntil(row.date),
          companyId: veh.companyId,
          companyName: veh.company.nameAr,
          href: `/dashboard/companies/${veh.companyId}/vehicles`,
          category: "vehicle",
          linkedLicense: formatLicenseSummary(veh.license?.commercialNameAr, veh.license?.licenseNumber),
          responsibleName: veh.assignedEmployee?.nameAr ?? null,
        });
      }
    }
  }

  if (alerts.length === 0) return null;

  alerts.sort((a, b) => {
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.entityLabel.localeCompare(b.entityLabel, "ar");
  });

  const totals = {
    danger: alerts.filter((item) => item.daysLeft <= 30).length,
    warning: alerts.filter((item) => item.daysLeft > 30 && item.daysLeft <= 60).length,
    notice: alerts.filter((item) => item.daysLeft > 60).length,
  };

  return { alerts, totals };
}

export async function ExpiryAlertsPanel({ companyIds }: Props) {
  const data = await getExpiryAlerts(companyIds);
  if (!data) return null;
  return <ExpiryAlertsPanelClient alerts={data.alerts} maxShown={10} totals={data.totals} />;
}
