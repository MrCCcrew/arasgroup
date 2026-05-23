import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { upsertNotification } from "@/lib/notifications";

interface Props {
  params: Promise<{ companyId: string }>;
}

const TYPE_LABELS = {
  ar: {
    DRIVER: "سائق",
    CAR_WASH_DRIVER: "سائق غسيل",
    CAR_WASH_WORKER: "عامل غسيل",
    OFFICE_EMPLOYEE: "موظف مكتب",
    ACCOUNTANT: "محاسب",
    MANDOUB: "مندوب",
    OFFICE_BOY: "عامل خدمات",
  },
  en: {
    DRIVER: "Driver",
    CAR_WASH_DRIVER: "Car Wash Driver",
    CAR_WASH_WORKER: "Car Wash Worker",
    OFFICE_EMPLOYEE: "Office Employee",
    ACCOUNTANT: "Accountant",
    MANDOUB: "Mandoub",
    OFFICE_BOY: "Office Boy",
  },
} as const;

export default async function ExpiryAlertsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 864e5);

  // نجيب المنتهية (days < 0) + القريبة (خلال 90 يوم)
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      isDeleted: false,
      OR: [
        { residencyExpiry: { lte: in90 } },   // منتهية أو قريبة
        { licenseExpiry: { lte: in90 } },
      ],
    },
    orderBy: { residencyExpiry: "asc" },
  });

  const urgency = (date: Date | null) => {
    if (!date) return "none";
    const days = Math.ceil((date.getTime() - now.getTime()) / 864e5);
    if (days < 0) return "expired";
    if (days <= 30) return "critical";
    if (days <= 60) return "warning";
    return "ok";
  };

  const daysLeft = (date: Date | null) => {
    if (!date) return null;
    return Math.ceil((date.getTime() - now.getTime()) / 864e5);
  };

  // إنشاء/تحديث إشعارات للإقامات المنتهية
  await Promise.all(
    employees
      .filter((e) => e.residencyExpiry && urgency(e.residencyExpiry) === "expired")
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
        })
      )
  );

  const expired = employees.filter((e) => e.residencyExpiry && urgency(e.residencyExpiry) === "expired").length;
  const within30 = employees.filter((employee) => employee.residencyExpiry && urgency(employee.residencyExpiry) === "critical").length;
  const within60 = employees.filter((employee) => employee.residencyExpiry && urgency(employee.residencyExpiry) === "warning").length;

  return (
    <div>
      <Header
        title={locale === "en" ? "Expiry Alerts" : "تنبيهات الانتهاء"}
        subtitle={locale === "en" ? "Residencies and licenses nearing expiry" : "إقامات ورخص تنتهي قريباً"}
        companyId={companyId}
      />
      <div className="page-container space-y-4">
        <div className="grid grid-cols-3 gap-4" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {[
            { label: locale === "en" ? "Expired" : "منتهية الآن", count: expired, color: "red" },
            { label: locale === "en" ? "Within 30 days" : "خلال 30 يوم", count: within30, color: "orange" },
            { label: locale === "en" ? "Within 60 days" : "خلال 60 يوم", count: within60, color: "yellow" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${stat.color}-50`}>
                <AlertTriangle size={20} className={`text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="section-card overflow-hidden">
          <h2 className="mb-4 text-base font-bold">{locale === "en" ? "Expiry details" : "تفاصيل الانتهاء"}</h2>
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Employee" : "الموظف"}</th>
                  <th>{locale === "en" ? "Position" : "الوظيفة"}</th>
                  <th>{locale === "en" ? "Residency expiry" : "انتهاء الإقامة"}</th>
                  <th>{locale === "en" ? "Days left" : "الأيام المتبقية"}</th>
                  <th>{locale === "en" ? "License expiry" : "انتهاء الرخصة"}</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No upcoming expiries" : "لا توجد انتهاءات قريبة"}
                    </td>
                  </tr>
                ) : (
                  employees.map((employee) => {
                    const days = daysLeft(employee.residencyExpiry);
                    const level = urgency(employee.residencyExpiry);
                    return (
                      <tr key={employee.id} className="hover:bg-muted/30">
                        <td className="font-medium">{locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr}</td>
                        <td className="text-xs text-muted-foreground">
                          {TYPE_LABELS[locale][employee.type as keyof typeof TYPE_LABELS.ar] ?? employee.type}
                        </td>
                        <td className="text-sm">{employee.residencyExpiry ? formatDate(employee.residencyExpiry, numberLocale) : "-"}</td>
                        <td>
                          {days !== null ? (
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${
                                level === "expired"
                                  ? "bg-red-100 text-red-700"
                                  : level === "critical"
                                    ? "bg-orange-100 text-orange-700"
                                    : level === "warning"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {level === "expired"
                                ? (locale === "en" ? "EXPIRED" : "منتهية")
                                : (locale === "en" ? `${days} day(s)` : `${days} يوم`)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="text-sm">{employee.licenseExpiry ? formatDate(employee.licenseExpiry, numberLocale) : "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
