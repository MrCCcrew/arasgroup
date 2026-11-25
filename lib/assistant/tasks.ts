// Smart assistant — role-aware task list.
// READ-ONLY: every query here is a count/groupBy; nothing is written. Each task is shown only
// when the user holds the matching permission for that company (same checks the pages use).
import { prisma } from "@/lib/db";
import { hasPermission, type Module } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/types";

export type AssistantArea = "accounting" | "hr" | "operations" | "admin" | "data" | "personal";
export type AssistantSeverity = "crit" | "warn" | "info";

export interface AssistantTask {
  id: string;
  area: AssistantArea;
  severity: AssistantSeverity;
  title: string;
  detail: string;
  count: number;
  href: string;
  companyId: string | null;
  companyName: string | null;
}

const DAY = 24 * 60 * 60 * 1000;
const RETAIL_TYPES = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

type CountRow = { companyId: string; _count: { _all: number } };
const toMap = (rows: CountRow[]) => new Map(rows.map((row) => [row.companyId, row._count._all]));

export async function getAssistantTasks(session: SessionUser, focusCompanyId?: string | null): Promise<AssistantTask[]> {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * DAY);
  const in60 = new Date(now.getTime() + 60 * DAY);

  type CompanyRow = { id: string; nameAr: string; type: string };
  const companies: CompanyRow[] = await prisma.company.findMany({
    where: {
      isActive: true,
      type: { not: "OWNER_MANAGED" },
      ...(session.isSuperAdmin ? {} : { id: { in: session.companyAccess } }),
      ...(focusCompanyId ? { id: focusCompanyId } : {}),
    },
    select: { id: true, nameAr: true, type: true },
    orderBy: { sortOrder: "asc" },
  });
  if (focusCompanyId && !session.isSuperAdmin && !session.companyAccess.includes(focusCompanyId)) return personalOnly();

  const can = (companyId: string, ...modules: Module[]) => modules.some((module) => hasPermission(session, module, "VIEW", { companyId }));
  const ids = (predicate: (company: CompanyRow) => boolean) => companies.filter(predicate).map((company) => company.id);

  const accIds = ids((c) => can(c.id, "ACCOUNTING"));
  const hrIds = ids((c) => can(c.id, "HR", "EMPLOYEES"));
  const salaryIds = ids((c) => can(c.id, "SALARIES", "HR"));
  const invoiceIds = ids((c) => c.type === "DELIVERY" && can(c.id, "DRIVER_INVOICES", "DELIVERY_INVOICES", "DELIVERY_OPERATIONS"));
  const depositIds = ids((c) => c.type === "DELIVERY" && can(c.id, "DELIVERY_OPERATIONS"));
  const violationIds = ids((c) => c.type === "DELIVERY" && can(c.id, "DELIVERY_OPERATIONS", "DELIVERY_HR"));
  const incidentIds = ids((c) => can(c.id, "VEHICLES", "DELIVERY_OPERATIONS"));
  const licenseIds = ids((c) => can(c.id, "LICENSES", "ADMINISTRATIVE_AFFAIRS"));
  const vehicleIds = ids((c) => can(c.id, "VEHICLES", "ADMINISTRATIVE_AFFAIRS"));
  const claimIds = ids((c) => ["GENERAL_TRADING", "TRADING"].includes(c.type) && can(c.id, "INVESTOR_CLAIMS"));
  const talabatIds = ids((c) => c.type === "DELIVERY" && can(c.id, "DELIVERY_OPERATIONS", "DELIVERY_REPORTS"));
  const carWashIds = ids((c) => c.type === "CAR_WASH" && can(c.id, "CAR_WASH_OPERATIONS"));
  const approverIds = new Set<string>(accIds.filter((id: string) => hasPermission(session, "ACCOUNTING", "APPROVE", { companyId: id })));

  const employeeBase = (companyIds: string[]) => ({ companyId: { in: companyIds }, isActive: true, isDeleted: false });
  const none = Promise.resolve([] as CountRow[]);
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    jeDraft, jePending, jeApproved,
    resExpired, resSoon, healthSoon, passportSoon,
    salaryThisMonth,
    invPending, depPending, violPending, incidentsOpen,
    licSoon, vehSoon, claimsOverdue,
    fiscalEnding, reminders,
  ] = await Promise.all([
    accIds.length ? prisma.journalEntry.groupBy({ by: ["companyId"], where: { companyId: { in: accIds }, isDeleted: false, status: "DRAFT" }, _count: { _all: true } }) : none,
    accIds.length ? prisma.journalEntry.groupBy({ by: ["companyId"], where: { companyId: { in: accIds }, isDeleted: false, status: "PENDING_APPROVAL" }, _count: { _all: true } }) : none,
    accIds.length ? prisma.journalEntry.groupBy({ by: ["companyId"], where: { companyId: { in: accIds }, isDeleted: false, status: "APPROVED" }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), residencyExpiry: { lt: now } }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), residencyExpiry: { gte: now, lte: in30 } }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), healthCardExpiryDate: { lte: in30 } }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), passportExpiryDate: { lte: in60 } }, _count: { _all: true } }) : none,
    salaryIds.length ? prisma.salaryBatch.findMany({ where: { companyId: { in: salaryIds }, month, year }, select: { companyId: true, status: true } }) : Promise.resolve([] as { companyId: string; status: string }[]),
    invoiceIds.length ? prisma.deliveryInvoice.groupBy({ by: ["companyId"], where: { companyId: { in: invoiceIds }, deletedAt: null, reviewStatus: "PENDING_REVIEW" }, _count: { _all: true } }) : none,
    depositIds.length ? prisma.driverDepositSubmission.groupBy({ by: ["companyId"], where: { companyId: { in: depositIds }, deletedAt: null, reviewStatus: "PENDING_REVIEW" }, _count: { _all: true } }) : none,
    violationIds.length ? prisma.driverViolation.groupBy({ by: ["companyId"], where: { companyId: { in: violationIds }, status: "PENDING" }, _count: { _all: true } }) : none,
    incidentIds.length ? prisma.vehicleIncident.groupBy({ by: ["companyId"], where: { companyId: { in: incidentIds }, status: { in: ["OPEN", "IN_REPAIR"] } }, _count: { _all: true } }) : none,
    licenseIds.length ? prisma.license.groupBy({ by: ["companyId"], where: { companyId: { in: licenseIds }, status: { not: "CANCELLED" }, licenseExpiryDate: { lte: in60 } }, _count: { _all: true } }) : none,
    vehicleIds.length ? prisma.vehicle.groupBy({ by: ["companyId"], where: { companyId: { in: vehicleIds }, isActive: true, OR: [{ registrationExpiry: { lte: in30 } }, { insuranceExpiry: { lte: in30 } }] }, _count: { _all: true } }) : none,
    claimIds.length ? prisma.investorClaim.groupBy({ by: ["companyId"], where: { companyId: { in: claimIds }, status: { in: ["PENDING", "SENT_TO_ACCOUNTANT", "SENT_TO_INVESTOR", "PARTIALLY_COLLECTED"] }, dueDate: { lt: now } }, _count: { _all: true } }) : none,
    accIds.length ? prisma.fiscalYear.findMany({ where: { companyId: { in: accIds }, isCurrent: true, isLocked: false, endDate: { lte: in30 } }, select: { companyId: true, year: true, endDate: true } }) : Promise.resolve([] as { companyId: string; year: number; endDate: Date }[]),
    prisma.reminder.findMany({ where: { userId: session.id, isCompleted: false, dueAt: { lte: new Date(now.getTime() + DAY) } }, select: { id: true, title: true, dueAt: true }, orderBy: { dueAt: "asc" }, take: 5 }),
  ]);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevMonthYear = month === 1 ? year - 1 : year;
  const [
    talabatDraft, monthlyDraft, ordersToday, carWashOpen,
    empNoCivil, empNoResidency, empNoSalary, licNoExpiry, vehNoReg, currentFiscal,
  ] = await Promise.all([
    talabatIds.length ? prisma.talabatReportImport.groupBy({ by: ["companyId"], where: { companyId: { in: talabatIds }, status: "DRAFT" }, _count: { _all: true } }) : none,
    talabatIds.length ? prisma.deliveryMonthlyReport.groupBy({ by: ["companyId"], where: { companyId: { in: talabatIds }, status: "DRAFT", month: prevMonth, year: prevMonthYear }, _count: { _all: true } }) : none,
    depositIds.length && now.getHours() >= 15 ? prisma.deliveryDailyOrder.groupBy({ by: ["companyId"], where: { companyId: { in: depositIds }, date: { gte: startOfToday } }, _count: { _all: true } }) : none,
    carWashIds.length ? prisma.carWashDailyOperation.groupBy({ by: ["companyId"], where: { companyId: { in: carWashIds }, status: "OPEN", date: { lt: startOfToday } }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), OR: [{ civilId: null }, { civilId: "" }] }, _count: { _all: true } }) : none,
    hrIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(hrIds), residencyExpiry: null, NOT: [{ nationality: { contains: "كويت" } }, { nationality: { contains: "Kuwait" } }] }, _count: { _all: true } }) : none,
    salaryIds.length ? prisma.employee.groupBy({ by: ["companyId"], where: { ...employeeBase(salaryIds), baseSalary: null, actualSalary: null }, _count: { _all: true } }) : none,
    licenseIds.length ? prisma.license.groupBy({ by: ["companyId"], where: { companyId: { in: licenseIds }, status: { not: "CANCELLED" }, licenseExpiryDate: null }, _count: { _all: true } }) : none,
    vehicleIds.length ? prisma.vehicle.groupBy({ by: ["companyId"], where: { companyId: { in: vehicleIds }, isActive: true, registrationExpiry: null }, _count: { _all: true } }) : none,
    accIds.length ? prisma.fiscalYear.findMany({ where: { companyId: { in: accIds }, isCurrent: true }, select: { companyId: true } }) : Promise.resolve([] as { companyId: string }[]),
  ]);

  const tasks: AssistantTask[] = [];
  const nameOf = new Map<string, string>(companies.map((company) => [company.id, company.nameAr]));
  const base = (companyId: string) => `/dashboard/companies/${companyId}`;
  const push = (rows: Map<string, number>, build: (companyId: string, count: number) => Omit<AssistantTask, "id" | "count" | "companyId" | "companyName">, key: string) => {
    rows.forEach((count, companyId) => {
      if (count <= 0) return;
      tasks.push({ id: `${key}:${companyId}`, count, companyId, companyName: nameOf.get(companyId) ?? null, ...build(companyId, count) });
    });
  };

  // ── Accounting ──
  push(toMap(jePending as CountRow[]), (id, n) => ({ area: "accounting", severity: approverIds.has(id) ? "crit" : "warn", title: approverIds.has(id) ? "قيود بانتظار اعتمادك" : "قيود بانتظار الاعتماد", detail: `${n} قيد محتاج مراجعة واعتماد`, href: `${base(id)}/accounting/journal-entries?status=PENDING_APPROVAL` }), "je-pending");
  push(toMap(jeApproved as CountRow[]), (id, n) => ({ area: "accounting", severity: "warn", title: "قيود معتمدة لم تُرحّل", detail: `${n} قيد معتمد ومحتاج ترحيل`, href: `${base(id)}/accounting/journal-entries?status=APPROVED` }), "je-approved");
  push(toMap(jeDraft as CountRow[]), (id, n) => ({ area: "accounting", severity: "info", title: "قيود مسودة", detail: `${n} قيد لسه مسودة`, href: `${base(id)}/accounting/journal-entries?status=DRAFT` }), "je-draft");
  for (const fy of fiscalEnding as { companyId: string; year: number; endDate: Date }[]) {
    const days = Math.ceil((fy.endDate.getTime() - now.getTime()) / DAY);
    tasks.push({ id: `fy:${fy.companyId}`, area: "accounting", severity: days <= 7 ? "crit" : "warn", title: days < 0 ? `السنة المالية ${fy.year} انتهت ولم تُقفل` : `السنة المالية ${fy.year} تنتهي خلال ${days} يوم`, detail: "راجع القيود وجهّز الإقفال", count: 1, href: `${base(fy.companyId)}/accounting/fiscal-years`, companyId: fy.companyId, companyName: nameOf.get(fy.companyId) ?? null });
  }

  // ── HR ──
  push(toMap(resExpired as CountRow[]), (id, n) => ({ area: "hr", severity: "crit", title: "إقامات منتهية", detail: `${n} موظف إقامته انتهت`, href: `${base(id)}/hr/expiry-alerts` }), "res-expired");
  push(toMap(resSoon as CountRow[]), (id, n) => ({ area: "hr", severity: "warn", title: "إقامات تنتهي خلال 30 يوم", detail: `${n} موظف محتاج تجديد`, href: `${base(id)}/hr/expiry-alerts` }), "res-soon");
  push(toMap(healthSoon as CountRow[]), (id, n) => ({ area: "hr", severity: "warn", title: "بطاقات صحية منتهية أو قريبة", detail: `${n} بطاقة خلال 30 يوم`, href: `${base(id)}/hr/expiry-alerts` }), "health");
  push(toMap(passportSoon as CountRow[]), (id, n) => ({ area: "hr", severity: "info", title: "جوازات منتهية أو قريبة", detail: `${n} جواز خلال 60 يوم`, href: `${base(id)}/hr/expiry-alerts` }), "passport");
  if (now.getDate() >= 20) {
    const byCompany = new Map<string, string>((salaryThisMonth as { companyId: string; status: string }[]).map((batch) => [batch.companyId, String(batch.status)]));
    for (const companyId of salaryIds) {
      const company = companies.find((c) => c.id === companyId);
      if (!company || RETAIL_TYPES.includes(company.type)) continue;
      const status = byCompany.get(companyId);
      if (status === "APPROVED" || status === "PAID" || status === "CANCELLED") continue;
      tasks.push({ id: `salary:${companyId}`, area: "hr", severity: now.getDate() >= 27 ? "crit" : "warn", title: status === "DRAFT" ? `رواتب ${MONTHS_AR[month - 1]} لم تُعتمد` : `رواتب ${MONTHS_AR[month - 1]} لم تُجهّز`, detail: status === "DRAFT" ? "الكشف موجود كمسودة" : "مفيش كشف رواتب للشهر ده لسه", count: 1, href: `${base(companyId)}/hr/salaries`, companyId, companyName: company.nameAr });
    }
  }

  // ── Operations (delivery / car wash) ──
  push(toMap(invPending as CountRow[]), (id, n) => ({ area: "operations", severity: n >= 10 ? "crit" : "warn", title: "فواتير سائقين بانتظار المراجعة", detail: `${n} فاتورة مرفوعة من السائقين`, href: `${base(id)}/delivery/invoices` }), "inv");
  push(toMap(depPending as CountRow[]), (id, n) => ({ area: "operations", severity: "warn", title: "إيداعات سائقين بانتظار المراجعة", detail: `${n} إيصال إيداع محتاج اعتماد`, href: `${base(id)}/delivery/deposits` }), "dep");
  push(toMap(violPending as CountRow[]), (id, n) => ({ area: "operations", severity: "info", title: "مخالفات لم تُسوَّ", detail: `${n} مخالفة معلّقة`, href: `${base(id)}/delivery/violations` }), "viol");
  push(toMap(incidentsOpen as CountRow[]), (id, n) => ({ area: "operations", severity: "info", title: "حوادث مركبات مفتوحة", detail: `${n} حادث لم يُغلق`, href: companies.find((c) => c.id === id)?.type === "DELIVERY" ? `${base(id)}/delivery/vehicle-incidents` : `${base(id)}/vehicles` }), "incident");

  // ── Admin affairs ──
  push(toMap(licSoon as CountRow[]), (id, n) => ({ area: "admin", severity: "warn", title: "تراخيص منتهية أو تنتهي خلال 60 يوم", detail: `${n} ترخيص محتاج متابعة`, href: `${base(id)}/licenses` }), "lic");
  push(toMap(vehSoon as CountRow[]), (id, n) => ({ area: "admin", severity: "warn", title: "تسجيل أو تأمين مركبات قارب على الانتهاء", detail: `${n} مركبة خلال 30 يوم`, href: `${base(id)}/vehicles` }), "veh");
  push(toMap(claimsOverdue as CountRow[]), (id, n) => ({ area: "admin", severity: "warn", title: "مطالبات مسئولين متأخرة", detail: `${n} مطالبة عدّى ميعادها`, href: `${base(id)}/investors/claims` }), "claims");

  push(toMap(talabatDraft as CountRow[]), (id, n) => ({ area: "operations", severity: "warn", title: "تقارير طلبات لم تُرحّل", detail: `${n} تقرير مستورد لسه مسودة`, href: `${base(id)}/delivery/talabat-imports` }), "talabat");
  push(toMap(monthlyDraft as CountRow[]), (id, n) => ({ area: "operations", severity: "warn", title: `التقرير الشهري لـ ${MONTHS_AR[prevMonth - 1]} لم يُعتمد`, detail: `${n} تقرير شهري مسودة`, href: `${base(id)}/delivery/monthly-reports` }), "monthly");
  if (now.getHours() >= 15) {
    const recorded = toMap(ordersToday as CountRow[]);
    for (const companyId of depositIds) {
      if ((recorded.get(companyId) ?? 0) > 0) continue;
      tasks.push({ id: `orders-today:${companyId}`, area: "operations", severity: "info", title: "لم تُسجَّل طلبات اليوم", detail: "مفيش أوردرات يومية متسجلة النهارده لسه", count: 1, href: `${base(companyId)}/delivery/daily-orders/new`, companyId, companyName: nameOf.get(companyId) ?? null });
    }
  }
  push(toMap(carWashOpen as CountRow[]), (id, n) => ({ area: "operations", severity: "warn", title: "أيام غسيل مفتوحة لم تُقفل", detail: `${n} يوم تشغيل لسه مفتوح`, href: `${base(id)}/car-wash/operations` }), "carwash-open");

  // ── Missing data (what is incomplete in the records) ──
  push(toMap(empNoCivil as CountRow[]), (id, n) => ({ area: "data", severity: "warn", title: "موظفين من غير رقم مدني", detail: `${n} موظف ناقصه الرقم المدني`, href: `${base(id)}/hr/employees` }), "no-civil");
  push(toMap(empNoResidency as CountRow[]), (id, n) => ({ area: "data", severity: "warn", title: "موظفين من غير تاريخ انتهاء إقامة", detail: `${n} موظف، فتنبيهات الإقامة مش هتشتغل لهم`, href: `${base(id)}/hr/employees` }), "no-residency");
  push(toMap(empNoSalary as CountRow[]), (id, n) => ({ area: "data", severity: "info", title: "موظفين من غير راتب مسجّل", detail: `${n} موظف ناقصه الراتب`, href: `${base(id)}/hr/employees` }), "no-salary");
  push(toMap(licNoExpiry as CountRow[]), (id, n) => ({ area: "data", severity: "warn", title: "تراخيص من غير تاريخ انتهاء", detail: `${n} ترخيص، فمش هيظهر تنبيه قبل انتهائه`, href: `${base(id)}/licenses` }), "lic-no-expiry");
  push(toMap(vehNoReg as CountRow[]), (id, n) => ({ area: "data", severity: "info", title: "مركبات من غير تاريخ انتهاء التسجيل", detail: `${n} مركبة ناقصها التاريخ`, href: `${base(id)}/vehicles` }), "veh-no-reg");
  {
    const withCurrent = new Set((currentFiscal as { companyId: string }[]).map((row) => row.companyId));
    for (const companyId of accIds) {
      if (withCurrent.has(companyId)) continue;
      tasks.push({ id: `no-fy:${companyId}`, area: "data", severity: "warn", title: "مفيش سنة مالية حالية", detail: "حدد السنة المالية الحالية علشان القيود والتقارير", count: 1, href: `${base(companyId)}/accounting/fiscal-years`, companyId, companyName: nameOf.get(companyId) ?? null });
    }
  }

  // ── Personal ──
  for (const reminder of reminders as { id: string; title: string; dueAt: Date }[]) {
    const overdue = reminder.dueAt < now;
    tasks.push({ id: `rem:${reminder.id}`, area: "personal", severity: overdue ? "crit" : "info", title: reminder.title, detail: overdue ? "تذكير متأخر" : "تذكير خلال 24 ساعة", count: 1, href: "/dashboard/reminders", companyId: null, companyName: null });
  }

  const rank = { crit: 0, warn: 1, info: 2 } as const;
  return tasks.sort((a, b) => rank[a.severity] - rank[b.severity] || b.count - a.count);

  function personalOnly() { return [] as AssistantTask[]; }
}
