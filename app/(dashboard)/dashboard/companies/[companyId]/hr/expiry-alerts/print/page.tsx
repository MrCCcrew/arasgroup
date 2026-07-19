import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDate, formatDateShort, formatKWD } from "@/lib/utils";
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
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; background: #f5f5f5; font-size: 9pt; }
        .page { max-width: 297mm; margin: 1rem auto; background: white; padding: 1.5rem; border: 1px solid #d1d5db; }
        .report-header { text-align: center; border-bottom: 2px solid #7c2d12; padding-bottom: 0.75rem; margin-bottom: 1rem; }
        .report-header-inner { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .company-logo { width: 48px; height: 48px; object-fit: contain; border-radius: 6px; border: 1px solid #e5e7eb; padding: 3px; background: white; }
        .company-name { font-size: 1.1rem; font-weight: 700; color: #7c2d12; }
        .report-title { font-size: 0.95rem; font-weight: 600; margin-top: 0.25rem; }
        .report-sub { font-size: 0.75rem; color: #6b7280; margin-top: 0.15rem; }
        .print-date { font-size: 0.7rem; color: #9ca3af; margin-top: 0.15rem; }
        .filters { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; font-size: 0.7rem; }
        .filter-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.4rem 0.5rem; background: #fafafa; }
        .filter-label { color: #6b7280; margin-bottom: 0.1rem; font-size: 0.65rem; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.75rem; }
        .stat { border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.4rem; text-align: center; }
        .stat-num { font-size: 1.1rem; font-weight: 700; }
        h3 { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.4rem; color: #374151; }
        table { width: 100%; border-collapse: collapse; font-size: 0.62rem; margin-top: 0.3rem; table-layout: fixed; }
        th { background: #7c2d12; color: white; padding: 0.25rem 0.3rem; text-align: right; border: 1px solid #7c2d12; font-weight: 600; font-size: 0.6rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        td { padding: 0.25rem 0.3rem; border: 1px solid #d1d5db; font-size: 0.6rem; overflow: hidden; text-overflow: ellipsis; }
        tr:nth-child(even) td { background: #f9fafb; }
        .badge { display: inline-block; border-radius: 999px; padding: 0.1rem 0.35rem; font-size: 0.55rem; font-weight: 700; white-space: nowrap; }
        .expired { background: #fee2e2; color: #b91c1c; }
        .critical { background: #ffedd5; color: #c2410c; }
        .warning { background: #fef3c7; color: #b45309; }
        .upcoming { background: #dbeafe; color: #1d4ed8; }
        @media print {
          .controls { display: none !important; }
          body { background: white; font-size: 8pt; }
          .page { border: none; padding: 0.75cm; margin: 0; max-width: 100%; }
          @page { size: A4 landscape; margin: 0.75cm; }
          table { font-size: 0.58rem; }
          th { font-size: 0.56rem; padding: 0.2rem 0.25rem; }
          td { font-size: 0.56rem; padding: 0.2rem 0.25rem; }
          .badge { font-size: 0.52rem; }
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
          <div className="filter-card">
            <div className="filter-label">من تاريخ</div>
            <div>{filters.dateFrom ? new Date(filters.dateFrom).toLocaleDateString("ar-KW") : "الكل"}</div>
          </div>
          <div className="filter-card">
            <div className="filter-label">إلى تاريخ</div>
            <div>{filters.dateTo ? new Date(filters.dateTo).toLocaleDateString("ar-KW") : "الكل"}</div>
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
          <>
            {filteredAlerts.some((a) => a.category === "employee") ? (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>الموظفون</h3>
                <table>
                  <thead>
                    <tr>
                      <th>رقم الموظف</th>
                      <th>الاسم</th>
                      <th>الرقم المدني</th>
                      <th>تاريخ الانتهاء</th>
                      <th>الوظيفة</th>
                      <th>الراتب</th>
                      <th>المسؤول</th>
                      <th>ترخيص الإقامة</th>
                      <th>ترخيص العمل</th>
                      <th>التليفون</th>
                      <th>الترخيص الرئيسي</th>
                      <th>المفوض بالتوقيع</th>
                      <th>نوع الانتهاء</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts
                      .filter((a) => a.category === "employee")
                      .map((alert) => {
                        const severity =
                          alert.daysLeft < 0 ? "expired" : alert.daysLeft <= 30 ? "critical" : alert.daysLeft <= 60 ? "warning" : "upcoming";
                        return (
                          <tr key={alert.id}>
                            <td>{alert.employeeNumber || "—"}</td>
                            <td>{alert.title}</td>
                            <td>{alert.civilId || "—"}</td>
                            <td>{formatDateShort(alert.expiryDate, "en-US")}</td>
                            <td>{alert.position || "—"}</td>
                            <td>{alert.salary ? formatKWD(alert.salary, "en-US") : "—"}</td>
                            <td>{alert.investor || "—"}</td>
                            <td>{alert.residencyLicenseName || "—"}</td>
                            <td>{alert.workPermitLicenseName || "—"}</td>
                            <td>{alert.phone || "—"}</td>
                            <td>{alert.mainLicenseName || "—"}</td>
                            <td>{alert.authorizedSigner || "—"}</td>
                            <td>{alert.expiryType}</td>
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
              </div>
            ) : null}

            {filteredAlerts.some((a) => a.category !== "employee") ? (
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "0.5rem" }}>المركبات والتراخيص</h3>
                <table>
                  <thead>
                    <tr>
                      <th>القسم</th>
                      <th>العنصر</th>
                      <th>التفصيل</th>
                      <th>الترخيص</th>
                      <th>نوع الانتهاء</th>
                      <th>تاريخ الانتهاء</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAlerts
                      .filter((a) => a.category !== "employee")
                      .map((alert) => {
                        const severity =
                          alert.daysLeft < 0 ? "expired" : alert.daysLeft <= 30 ? "critical" : alert.daysLeft <= 60 ? "warning" : "upcoming";
                        return (
                          <tr key={alert.id}>
                            <td>{alert.category === "vehicle" ? "المركبات" : "التراخيص"}</td>
                            <td>{alert.title}</td>
                            <td>{alert.subtitle}</td>
                            <td>{alert.licenseName || "—"}</td>
                            <td>{alert.expiryType}</td>
                            <td>{formatDateShort(alert.expiryDate, "en-US")}</td>
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
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
