import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { PrintControls } from "@/components/ui/print-controls";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { canAccessCompany, getAccessibleBranchIds, hasPermission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/types";
import { loadHourlyReport, summarizeHourlyReport, type WorkReportSearch } from "@/lib/delivery/hourly-report";

export async function HourlyReport({ companyId, contractId, search, session, print = false }: { companyId: string; contractId: string; search: WorkReportSearch; session: SessionUser; print?: boolean }) {
  if (!canAccessCompany(session, companyId) || (!hasPermission(session, "DELIVERY_REPORTS", "VIEW", { companyId }) && !hasPermission(session, "DELIVERY_OPERATIONS", "VIEW", { companyId }))) notFound();
  const en = (await getLocale()) === "en"; const t = (ar: string, english: string) => en ? english : ar;
  const branchIds = getAccessibleBranchIds(session, companyId);
  const [contract, contracts, company, drivers, entities, report] = await Promise.all([
    prisma.deliveryContract.findFirst({ where: { id: contractId, companyId } }),
    prisma.deliveryContract.findMany({ where: { companyId, OR: [{ usesHourlyWork: true }, { usesLocationPricing: true }, { hourlyWorkEntries: { some: {} } }] }, select: { id: true, nameAr: true, nameEn: true }, orderBy: { nameAr: "asc" } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true } }),
    prisma.driver.findMany({ where: { employee: { companyId, ...(branchIds.length ? { branchId: { in: branchIds } } : {}) } }, select: { id: true, employee: { select: { nameAr: true, nameEn: true } } }, orderBy: { employee: { nameAr: "asc" } } }),
    prisma.deliveryWorkEntity.findMany({ where: { contractId, contract: { companyId } }, orderBy: { name: "asc" } }),
    loadHourlyReport(companyId, contractId, search, branchIds),
  ]);
  if (!contract) notFound();
  const summary = summarizeHourlyReport(report.rows, en);
  const duration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  const money = (amount: { toString(): string }) => `${Number(amount.toString()).toLocaleString(en ? "en-US" : "ar-KW", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} ${t("د.ك", "KWD")}`;
  const base = `/dashboard/companies/${companyId}/delivery/deliveries-report`;
  const query = new URLSearchParams({ contractId, mode: "hourly", from: report.period.fromString, to: report.period.toString, ...(search.driverId ? { driverId: search.driverId } : {}), ...(search.workEntityId ? { workEntityId: search.workEntityId } : {}) });
  const title = t("تقرير العمل بالساعة", "Hourly work report");
  return <div dir={en ? "ltr" : "rtl"}>
    {print ? <PrintControls backHref={`${base}?${query}`} /> : <Header companyId={companyId} title={title} subtitle={t("الساعات والأوردرات والمستحق حسب السائق وجهة العمل", "Hours, orders and amounts by driver and work entity")} actions={<a className="rounded border px-4 py-2" target="_blank" rel="noreferrer" href={`${base}/print?${query}`}>PDF</a>} />}
    {print && <style>{`@media print { @page { size: A4 landscape; margin: 12mm; } .hourly-report { padding: 0 !important; } .hourly-report tr { break-inside: avoid; } .hourly-report thead { display: table-header-group; } .hourly-report table { font-size: 10px; } }`}</style>}
    <div className="hourly-report page-container space-y-5">
      {print && <header className="space-y-2 text-center"><h1 className="text-xl font-bold">{company?.nameAr} — {title}</h1><p>{contract.nameAr}</p><p>{report.period.fromString} — {report.period.toString}</p><p>{search.driverId ? drivers.find(driver => driver.id === search.driverId)?.employee.nameAr : t("كل السائقين", "All drivers")} · {search.workEntityId ? entities.find(entity => entity.id === search.workEntityId)?.name : t("كل الجهات", "All entities")}</p></header>}
      {!print && <form method="GET" className="flex flex-wrap items-end gap-3">
        <label>{t("العقد", "Contract")}<select name="contractId" defaultValue={contractId} className="input-field mt-1 block">{contracts.map(item => <option key={item.id} value={item.id}>{en ? item.nameEn || item.nameAr : item.nameAr}</option>)}</select></label>
        <label>{t("نظام التقرير", "Report system")}<select name="mode" defaultValue="hourly" className="input-field mt-1 block"><option value="auto">{t("حسب إعداد العقد", "Contract default")}</option><option value="hourly">{t("العمل بالساعة", "Hourly work")}</option><option value="deliveries">{t("المطاعم والأماكن", "Restaurants & locations")}</option></select></label>
        <label>{t("السائق", "Driver")}<select name="driverId" defaultValue={search.driverId ?? ""} className="input-field mt-1 block"><option value="">{t("كل السائقين", "All drivers")}</option>{drivers.map(driver => <option key={driver.id} value={driver.id}>{en ? driver.employee.nameEn || driver.employee.nameAr : driver.employee.nameAr}</option>)}</select></label>
        <label>{t("جهة العمل", "Work entity")}<select name="workEntityId" defaultValue={search.workEntityId ?? ""} className="input-field mt-1 block"><option value="">{t("كل الجهات", "All entities")}</option>{entities.map(entity => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></label>
        <label>{t("من", "From")}<input name="from" type="date" defaultValue={report.period.fromString} className="input-field mt-1 block" /></label>
        <label>{t("إلى", "To")}<input name="to" type="date" defaultValue={report.period.toString} className="input-field mt-1 block" /></label>
        <button className="btn-primary rounded px-4 py-2">{t("تصفية", "Filter")}</button><Link className="rounded border px-4 py-2" href={`${base}?contractId=${contractId}&mode=hourly`}>{t("مسح", "Clear")}</Link>
      </form>}
      <p className="text-sm text-muted-foreground">{t("عدد الأوردرات للمتابعة فقط. المستحق هو قيمة الساعات المحفوظة بسعرها وقت التسجيل.", "Orders are for tracking only. Amounts use the saved hours and rates at the time of recording.")}</p>
      <div className="grid grid-cols-3 gap-3">{[[t("إجمالي الساعات (ساعة:دقيقة)", "Total hours (h:mm)"), duration(summary.minutes)], [t("عدد الأوردرات", "Orders"), summary.orders], [t("المستحق", "Amount"), money(summary.amount)]].map(([label, value]) => <div key={String(label)} className="stat-card"><p className="text-xl font-bold" dir="ltr">{value}</p><p>{label}</p></div>)}</div>
      <div className="grid gap-4 md:grid-cols-2">{[[t("حسب السائق", "By driver"), summary.byDriver], [t("حسب جهة العمل", "By work entity"), summary.byEntity]].map(([label, groups]) => <section className="section-card overflow-x-auto" key={String(label)}><h2 className="mb-2 font-bold">{String(label)}</h2><table className="ar-table"><thead><tr><th>{t("الاسم", "Name")}</th><th>{t("الساعات", "Hours")}</th><th>{t("الأوردرات", "Orders")}</th><th>{t("المستحق", "Amount")}</th></tr></thead><tbody>{(groups as typeof summary.byDriver).map(group => <tr key={group.id}><td>{group.name}</td><td dir="ltr">{duration(group.minutes)}</td><td>{group.orders}</td><td>{money(group.amount)}</td></tr>)}{!(groups as typeof summary.byDriver).length && <tr><td colSpan={4}>—</td></tr>}</tbody></table></section>)}</div>
      <section className="section-card overflow-x-auto"><h2 className="mb-2 font-bold">{t("التفاصيل", "Details")}</h2><table className="ar-table"><thead><tr>{[t("التاريخ", "Date"), t("السائق", "Driver"), t("جهة العمل", "Work entity"), t("الساعات", "Hours"), t("الأوردرات", "Orders"), t("سعر الساعة", "Hourly rate"), t("المستحق", "Amount")].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={row.id}><td>{row.date.toISOString().slice(0, 10)}</td><td>{en ? row.driver.employee.nameEn || row.driver.employee.nameAr : row.driver.employee.nameAr}</td><td>{row.workEntity.name}</td><td dir="ltr">{duration(row.minutes)}</td><td>{row.ordersCount}</td><td>{money(row.hourlyRate)}</td><td>{money(row.amount)}</td></tr>)}{!report.rows.length && <tr><td colSpan={7} className="py-6 text-center">{t("لا توجد ساعات مسجلة للفترة والفلاتر المحددة", "No hourly work matches this period and filters")}</td></tr>}</tbody><tfoot><tr className="font-bold"><td colSpan={3}>{t("الإجمالي", "Total")}</td><td dir="ltr">{duration(summary.minutes)}</td><td>{summary.orders}</td><td></td><td>{money(summary.amount)}</td></tr></tfoot></table></section>
    </div>
  </div>;
}
