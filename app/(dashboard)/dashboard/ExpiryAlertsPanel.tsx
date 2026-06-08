import { prisma } from "@/lib/db";
import Link from "next/link";
import { AlertTriangle, Building2, ChevronLeft, FileText, ShieldUser, UserRound } from "lucide-react";

interface Props {
  companyIds: string[];
}

interface AlertItem {
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

function severity(days: number): "danger" | "warning" | "notice" {
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "notice";
}

const DANGER_CLASSES = "bg-red-50/90 border-red-200 text-red-900";
const WARNING_CLASSES = "bg-orange-50/90 border-orange-200 text-orange-900";
const NOTICE_CLASSES = "bg-yellow-50/90 border-yellow-200 text-yellow-900";

const BADGE_DANGER = "bg-red-100 text-red-700 border border-red-200";
const BADGE_WARNING = "bg-orange-100 text-orange-700 border border-orange-200";
const BADGE_NOTICE = "bg-yellow-100 text-yellow-700 border border-yellow-200";

function formatLicenseSummary(name?: string | null, number?: string | null) {
  if (name && number) return `${name} - ${number}`;
  return name ?? number ?? null;
}

function buildMeta(item: AlertItem) {
  return [
    { icon: <Building2 size={13} />, text: `الشركة: ${item.companyName}` },
    item.linkedLicense ? { icon: <FileText size={13} />, text: `الترخيص: ${item.linkedLicense}` } : null,
    item.responsibleName ? { icon: <ShieldUser size={13} />, text: `المسؤول: ${item.responsibleName}` } : null,
  ].filter(Boolean) as Array<{ icon: React.ReactNode; text: string }>;
}

export async function ExpiryAlertsPanel({ companyIds }: Props) {
  if (companyIds.length === 0) return null;

  const now = new Date();
  const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const licenses = await prisma.license.findMany({
    where: {
      companyId: { in: companyIds },
      status: { not: "CANCELLED" },
      OR: [
        { licenseExpiryDate: { lte: in90, gte: now } },
        { fireLicenseExpiryDate: { lte: in90, gte: now } },
        { healthLicenseExpiryDate: { lte: in90, gte: now } },
        { advertisingLicenseExpiryDate: { lte: in90, gte: now } },
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
      advertisingLicenseExpiryDate: true,
      company: { select: { nameAr: true } },
    },
  });

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
      { date: lic.advertisingLicenseExpiryDate, label: "رخصة إعلانات" },
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

  const danger = alerts.filter((a) => a.daysLeft <= 30);
  const warning = alerts.filter((a) => a.daysLeft > 30 && a.daysLeft <= 60);
  const notice = alerts.filter((a) => a.daysLeft > 60);

  const MAX_SHOWN = 25;
  const shown = alerts.slice(0, MAX_SHOWN);
  const remaining = alerts.length - shown.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-red-200 bg-gradient-to-l from-red-50 to-orange-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
          </span>
          <h2 className="text-base font-bold text-red-800">تنبيهات الانتهاء</h2>
          <div className="flex items-center gap-1.5">
            {danger.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-red-300 bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {danger.length} حرجة
              </span>
            )}
            {warning.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-orange-300 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {warning.length} تحذير
              </span>
            )}
            {notice.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                {notice.length} تنبيه
              </span>
            )}
          </div>
        </div>
        <AlertTriangle size={18} className="shrink-0 text-red-400" />
      </div>

      <div className="divide-y divide-red-100/80">
        {shown.map((item) => {
          const sev = severity(item.daysLeft);
          const rowCls = sev === "danger" ? DANGER_CLASSES : sev === "warning" ? WARNING_CLASSES : NOTICE_CLASSES;
          const badgeCls = sev === "danger" ? BADGE_DANGER : sev === "warning" ? BADGE_WARNING : BADGE_NOTICE;
          const dayLabel =
            item.daysLeft === 0 ? "ينتهي اليوم" : item.daysLeft < 0 ? `انتهى منذ ${Math.abs(item.daysLeft)} يوم` : `${item.daysLeft} يوم`;
          const meta = buildMeta(item);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center justify-between gap-4 px-5 py-3 transition-opacity hover:opacity-85 ${rowCls}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 text-base text-current">
                    {item.category === "license" ? <FileText size={18} /> : item.category === "employee" ? <UserRound size={18} /> : <Building2 size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-current/15 bg-white/70 px-2 py-0.5 text-xs font-bold">
                        {item.expiryLabel}
                      </span>
                      <span className="truncate text-sm font-semibold">{item.entityLabel}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-current/80">
                      {meta.map((entry) => (
                        <span key={entry.text} className="inline-flex items-center gap-1.5">
                          {entry.icon}
                          <span>{entry.text}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${badgeCls}`}>
                  {dayLabel}
                </span>
                <ChevronLeft size={14} className="opacity-50" />
              </div>
            </Link>
          );
        })}

        {remaining > 0 && (
          <div className="bg-gray-50 px-5 py-3 text-center text-sm text-muted-foreground">
            و <span className="font-bold text-foreground">{remaining}</span> بندًا آخر قريب الانتهاء
          </div>
        )}
      </div>
    </div>
  );
}
