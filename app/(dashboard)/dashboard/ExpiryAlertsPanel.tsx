import { prisma } from "@/lib/db";
import Link from "next/link";
import { AlertTriangle, ChevronLeft } from "lucide-react";

interface Props {
  companyIds: string[];
}

interface AlertItem {
  key: string;
  label: string;
  daysLeft: number;
  companyId: string;
  href: string;
  category: "license" | "employee" | "vehicle";
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function severity(days: number): "danger" | "warning" | "notice" {
  if (days <= 30) return "danger";
  if (days <= 60) return "warning";
  return "notice";
}

const DANGER_CLASSES  = "bg-red-50 border-red-200 text-red-800";
const WARNING_CLASSES = "bg-orange-50 border-orange-200 text-orange-800";
const NOTICE_CLASSES  = "bg-yellow-50 border-yellow-200 text-yellow-800";

const BADGE_DANGER  = "bg-red-100 text-red-700 border border-red-200";
const BADGE_WARNING = "bg-orange-100 text-orange-700 border border-orange-200";
const BADGE_NOTICE  = "bg-yellow-100 text-yellow-700 border border-yellow-200";

export async function ExpiryAlertsPanel({ companyIds }: Props) {
  if (companyIds.length === 0) return null;

  const now = new Date();
  const in90 = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  // ── تراخيص ──
  const licenses = await prisma.license.findMany({
    where: {
      companyId: { in: companyIds },
      status: { not: "CANCELLED" },
      OR: [
        { licenseExpiryDate:          { lte: in90, gte: now } },
        { fireLicenseExpiryDate:      { lte: in90, gte: now } },
        { healthLicenseExpiryDate:    { lte: in90, gte: now } },
        { advertisingLicenseExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true, commercialNameAr: true, companyId: true,
      licenseExpiryDate: true, fireLicenseExpiryDate: true,
      healthLicenseExpiryDate: true, advertisingLicenseExpiryDate: true,
    },
  });

  // ── موظفين ──
  const employees = await prisma.employee.findMany({
    where: {
      isActive: true, isDeleted: false,
      companyId: { in: companyIds },
      OR: [
        { residencyExpiry:      { lte: in90, gte: now } },
        { passportExpiryDate:   { lte: in90, gte: now } },
        { licenseExpiry:        { lte: in90, gte: now } },
        { healthCardExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true, nameAr: true, companyId: true,
      residencyExpiry: true, passportExpiryDate: true,
      licenseExpiry: true, healthCardExpiryDate: true,
    },
  });

  // ── مركبات ──
  const vehicles = await prisma.vehicle.findMany({
    where: {
      isActive: true,
      companyId: { in: companyIds },
      OR: [
        { registrationExpiry:       { lte: in90, gte: now } },
        { insuranceExpiryDate:      { lte: in90, gte: now } },
        { insuranceExpiry:          { lte: in90, gte: now } },
        { municipalityCardExpiryDate: { lte: in90, gte: now } },
      ],
    },
    select: {
      id: true, plateNumber: true, companyId: true,
      registrationExpiry: true, insuranceExpiryDate: true,
      insuranceExpiry: true, municipalityCardExpiryDate: true,
    },
  });

  // ── بناء قائمة التنبيهات ──
  const alerts: AlertItem[] = [];

  for (const lic of licenses) {
    const rows = [
      { date: lic.licenseExpiryDate,            label: `رخصة تجارية: ${lic.commercialNameAr}` },
      { date: lic.fireLicenseExpiryDate,         label: `رخصة إطفاء: ${lic.commercialNameAr}` },
      { date: lic.healthLicenseExpiryDate,       label: `ترخيص صحي: ${lic.commercialNameAr}` },
      { date: lic.advertisingLicenseExpiryDate,  label: `رخصة إعلانات: ${lic.commercialNameAr}` },
    ];
    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `lic-${lic.id}-${row.label}`,
          label: row.label,
          daysLeft: daysUntil(row.date),
          companyId: lic.companyId,
          href: `/dashboard/companies/${lic.companyId}/licenses/${lic.id}`,
          category: "license",
        });
      }
    }
  }

  for (const emp of employees) {
    const rows = [
      { date: emp.residencyExpiry,      label: `إقامة: ${emp.nameAr}` },
      { date: emp.passportExpiryDate,   label: `جواز سفر: ${emp.nameAr}` },
      { date: emp.licenseExpiry,        label: `رخصة قيادة: ${emp.nameAr}` },
      { date: emp.healthCardExpiryDate, label: `بطاقة صحية: ${emp.nameAr}` },
    ];
    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `emp-${emp.id}-${row.label}`,
          label: row.label,
          daysLeft: daysUntil(row.date),
          companyId: emp.companyId,
          href: `/dashboard/companies/${emp.companyId}/hr/employees/${emp.id}`,
          category: "employee",
        });
      }
    }
  }

  for (const veh of vehicles) {
    const insDate = veh.insuranceExpiryDate ?? veh.insuranceExpiry;
    const rows = [
      { date: veh.registrationExpiry,          label: `تسجيل مركبة: ${veh.plateNumber}` },
      { date: insDate,                          label: `تأمين مركبة: ${veh.plateNumber}` },
      { date: veh.municipalityCardExpiryDate,   label: `بطاقة بلدية: ${veh.plateNumber}` },
    ];
    for (const row of rows) {
      if (row.date && row.date >= now && row.date <= in90) {
        alerts.push({
          key: `veh-${veh.id}-${row.label}`,
          label: row.label,
          daysLeft: daysUntil(row.date),
          companyId: veh.companyId,
          href: `/dashboard/companies/${veh.companyId}/vehicles`,
          category: "vehicle",
        });
      }
    }
  }

  if (alerts.length === 0) return null;

  // ترتيب: الأكثر إلحاحاً أولاً
  alerts.sort((a, b) => a.daysLeft - b.daysLeft);

  const danger  = alerts.filter((a) => a.daysLeft <= 30);
  const warning = alerts.filter((a) => a.daysLeft > 30 && a.daysLeft <= 60);
  const notice  = alerts.filter((a) => a.daysLeft > 60);

  // نعرض أول 25 بند + "وX أخرى" إذا زادت
  const MAX_SHOWN = 25;
  const shown = alerts.slice(0, MAX_SHOWN);
  const remaining = alerts.length - shown.length;

  return (
    <div className="rounded-2xl border border-red-200 bg-white shadow-sm overflow-hidden">
      {/* ── رأس القسم ── */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-l from-red-50 to-orange-50 px-5 py-4 border-b border-red-200">
        <div className="flex items-center gap-3">
          {/* نقطة وميض */}
          <span className="relative flex h-4 w-4 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-red-500" />
          </span>
          <h2 className="font-bold text-red-800 text-base">
            تنبيهات الانتهاء
          </h2>
          <div className="flex items-center gap-1.5">
            {danger.length > 0 && (
              <span className="animate-pulse inline-flex items-center rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-700">
                {danger.length} حرجة
              </span>
            )}
            {warning.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-xs font-semibold text-orange-700">
                {warning.length} تحذير
              </span>
            )}
            {notice.length > 0 && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 border border-yellow-300 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                {notice.length} تنبيه
              </span>
            )}
          </div>
        </div>
        <AlertTriangle size={18} className="text-red-400 shrink-0" />
      </div>

      {/* ── قائمة البنود ── */}
      <div className="divide-y divide-gray-100">
        {shown.map((item) => {
          const sev = severity(item.daysLeft);
          const rowCls = sev === "danger" ? DANGER_CLASSES : sev === "warning" ? WARNING_CLASSES : NOTICE_CLASSES;
          const badgeCls = sev === "danger" ? BADGE_DANGER : sev === "warning" ? BADGE_WARNING : BADGE_NOTICE;
          const dayLabel =
            item.daysLeft === 0
              ? "ينتهي اليوم"
              : item.daysLeft < 0
              ? `انتهى منذ ${Math.abs(item.daysLeft)} يوم`
              : `${item.daysLeft} يوم`;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center justify-between gap-3 px-5 py-3 transition-opacity hover:opacity-80 ${rowCls}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* أيقونة النوع */}
                <span className="text-base shrink-0">
                  {item.category === "license" ? "📋" : item.category === "employee" ? "👤" : "🚗"}
                </span>
                <span className="text-sm font-medium truncate">{item.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${badgeCls} ${sev === "danger" ? "animate-pulse" : ""}`}>
                  {dayLabel}
                </span>
                <ChevronLeft size={14} className="opacity-50" />
              </div>
            </Link>
          );
        })}

        {remaining > 0 && (
          <div className="px-5 py-3 text-center text-sm text-muted-foreground bg-gray-50">
            و <span className="font-bold text-foreground">{remaining}</span> بندًا آخر قريب الانتهاء
          </div>
        )}
      </div>
    </div>
  );
}
