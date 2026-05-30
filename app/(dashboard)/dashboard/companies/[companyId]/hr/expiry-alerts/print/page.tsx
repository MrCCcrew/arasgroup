import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { getExpiryAlertsData } from "../data";
import { applyAlertFilters, buildStats, buildFilterQuery, filtersFromSearchParams } from "../shared";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ExpiryAlertsPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const rawSearchParams = await searchParams;
  const filters = filtersFromSearchParams(rawSearchParams);
  const alerts = await getExpiryAlertsData(session, companyId);
  const filteredAlerts = applyAlertFilters(alerts, filters);
  const stats = buildStats(filteredAlerts);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true, logoUrl: true },
  });

  const backQuery = buildFilterQuery(filters);
  const backHref = `/dashboard/companies/${companyId}/hr/expiry-alerts${backQuery ? `?${backQuery}` : ""}`;
  const printDate = new Date().toLocaleDateString("ar-KW", { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 11pt; }
        .page { max-width: 210mm; margin: 2rem auto; background: white; padding: 2rem; border: 1px solid #d1d5db; }
        .report-header { text-align: center; border-bottom: 2px solid #7c2d12; padding-bottom: 1rem; margin-bottom: 1.5rem; }
        .report-header-inner { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 4px; background: white; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #7c2d12; }
        .report-title { font-size: 1.1rem; font-weight: 600; margin-top: 0.3rem; }
        .report-sub { font-size: 0.85rem; color: #6b7280; margin-top: 0.2rem; }
        .print-date { font-size: 0.78rem; color: #9ca3af; margin-top: 0.2rem; }
        .filters { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; font-size: 0.85rem; }
        .filter-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem; background: #fafafa; }
        .filter-label { color: #6b7280; margin-bottom: 0.2rem; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
        .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 0.75rem; text-align: center; }
        .stat-num { font-size: 1.4rem; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 0.5rem; }
        th { background: #7c2d12; color: white; padding: 0.4rem 0.5rem; text-align: right; border: 1px solid #7c2d12; font-weight: 600; font-size: 0.8rem; }
        td { padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge { display: inline-block; border-radius: 999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; font-weight: 700; }
        .expired { background: #fee2e2; color: #b91c1c; }
        .critical { background: #ffedd5; color: #c2410c; }
        .warning { background: #fef3c7; color: #b45309; }
        .upcoming { background: #dbeafe; color: #1d4ed8; }
        @media print {
          .controls { display: none !important; }
          body { background: white; }
          .page { border: none; padding: 0; margin: 0; max-width: 100%; }
          @page { size: A4 portrait; margin: 1.2cm; }
        }
      `}</style>

      <PrintControls backHref={backHref} />

      <div className="page">
        <div className="report-header">
          <div className="report-header-inner">
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.nameAr} className="company-logo" />
            )}
            <div>
              <p className="company-name">{company?.nameAr}</p>
              {company?.nameEn && <p style={{ fontSize: "0.85rem", color: "#374151", direction: "ltr" }}>{company.nameEn}</p>}
            </div>
          </div>
          <p className="report-title">تقرير تنبيهات الانتهاء</p>
          <p className="report-sub">التقرير مطابق للفلاتر المختارة في الشاشة</p>
          <p className="print-date">تاريخ الطباعة: {printDate}</p>
        </div>

        <div className="filters">
          <div className="filter-card">
            <div className="filter-label">البحث</div>
            <div>{filters.search || "الكل"}</div>
          </div>
          <div className="filter-card">
            <div className="filter-label">القسم</div>
            <div>{filters.category === "all" ? "كل الأقسام" : filters.category === "employee" ? "الموظفون" : filters.category === "vehicle" ? "المركبات" : "التراخيص"}</div>
          </div>
          <div className="filter-card">
            <div className="filter-label">الحالة</div>
            <div>{filters.status === "all" ? "كل الحالات" : filters.status}</div>
          </div>
          <div className="filter-card">
            <div className="filter-label">نوع الانتهاء</div>
            <div>{filters.expiryType === "all" ? "كل الأنواع" : filters.expiryType}</div>
          </div>
        </div>

        <div className="stats">
          <div className="stat"><div className="stat-num">{stats.expired}</div><div>منتهية الآن</div></div>
          <div className="stat"><div className="stat-num">{stats.in30}</div><div>خلال 30 يوم</div></div>
          <div className="stat"><div className="stat-num">{stats.in60}</div><div>خلال 60 يوم</div></div>
          <div className="stat"><div className="stat-num">{stats.in90}</div><div>خلال 90 يوم للتراخيص</div></div>
        </div>

        {filteredAlerts.length === 0 ? (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>لا توجد نتائج مطابقة للفلاتر الحالية</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>القسم</th>
                <th>العنصر</th>
                <th>التفصيل</th>
                <th>نوع الانتهاء</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.map((alert) => {
                const severity =
                  alert.daysLeft < 0 ? "expired" : alert.daysLeft <= 30 ? "critical" : alert.daysLeft <= 60 ? "warning" : "upcoming";
                return (
                  <tr key={alert.id}>
                    <td>{alert.category === "employee" ? "الموظفون" : alert.category === "vehicle" ? "المركبات" : "التراخيص"}</td>
                    <td>{alert.title}</td>
                    <td>{alert.subtitle}</td>
                    <td>{alert.expiryType}</td>
                    <td>{formatDate(alert.expiryDate, "ar-KW")}</td>
                    <td>
                      <span className={`badge ${severity}`}>
                        {severity === "expired" ? "منتهي" : `${alert.daysLeft} يوم`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
