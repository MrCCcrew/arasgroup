import { redirect } from "next/navigation";
import { Building2, Calculator, PackageCheck, TrendingUp, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { CostCenterFilters } from "./filters";

interface Props { params: Promise<{ companyId: string }>; searchParams: Promise<{ month?: string; year?: string }>; }
type CostKey = "housing" | "food" | "fuel" | "residency" | "vehicleRent" | "maintenance" | "phone" | "health" | "advertising" | "office" | "admin";
type Costs = Record<CostKey, number>;
const zeroCosts = (): Costs => ({ housing: 0, food: 0, fuel: 0, residency: 0, vehicleRent: 0, maintenance: 0, phone: 0, health: 0, advertising: 0, office: 0, admin: 0 });
const amount = (value: { toString(): string } | number | null | undefined) => Number(value ?? 0);

function classifyExpense(name: string): CostKey | null {
  const text = name.toLowerCase();
  if (/accommodation|housing|سكن|إسكان|ايجار سكن/.test(text)) return "housing";
  if (/food|meal|طعام|غذاء|وجبات/.test(text)) return "food";
  if (/fuel|petrol|diesel|transport|وقود|بنزين|نقل/.test(text)) return "fuel";
  if (/visa|residen|تأشيرة|فيزا|إقامة/.test(text)) return "residency";
  if (/vehicle.*rent|car.*rent|إيجار.*سيار|تأجير.*سيار/.test(text)) return "vehicleRent";
  if (/maintenance|repair|garage|صيانة|تصليح|كراج/.test(text)) return "maintenance";
  if (/phone|sim|mobile|gps|هاتف|شريحة|جوال/.test(text)) return "phone";
  if (/health card|بطاقة صحية/.test(text)) return "health";
  if (/advertis|marketing|إعلان|دعاية|ترخيص صحي/.test(text)) return "advertising";
  if (/office|electric|water|utility|مكتب|كهرباء|مياه|مرافق/.test(text)) return "office";
  if (/staff|admin salary|رواتب.*إدار|موظفين/.test(text)) return "admin";
  return null;
}

const HEADERS = {
  ar: ["الرقم الوظيفي", "اسم السائق", "إجمالي الطلبات", "هدف الحوافز", "الحوافز", "بدل السكن", "بدل الطعام", "الوقود", "الإقامة", "إيجار أو قسط السيارة", "صيانة السيارة", "المخالفات", "تليفون + خط + GPS", "كارت الصحة", "إعلان وترخيص صحي للسيارة", "تكاليف إيجار المكتب", "متوسط رواتب الإدارة"],
  en: ["Rider ID", "Rider Name", "Total Orders", "Incentive Target", "Incentive", "Housing Allowance", "Food Allowance", "Fuel", "Residency", "Vehicle Rent / Installment", "Vehicle Maintenance", "Violations", "Phone + SIM + GPS", "Health Card", "Advertising & Vehicle Health License", "Office Rent Cost", "Average Admin Salaries"],
};

export default async function CostCenterReportPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const dateWhere = { gte: start, lt: end };
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const [company, drivers, orders, salaries, expenses, violations, received] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true, nameEn: true, type: true } }),
    prisma.driver.findMany({ where: { employee: { companyId, isDeleted: false } }, include: { employee: { select: { id: true, nameAr: true, nameEn: true, employeeNumber: true } }, assignedVehicle: { select: { id: true, ownershipModel: true } } }, orderBy: { employee: { nameAr: "asc" } } }),
    prisma.deliveryDailyOrder.findMany({ where: { companyId, date: dateWhere }, select: { driverId: true, ordersCount: true } }),
    prisma.salaryPayment.findMany({ where: { employee: { companyId }, batch: { month, year } }, select: { employeeId: true, incentives: true, netAmount: true, targetOrders: true } }),
    prisma.expense.findMany({ where: { companyId, isDeleted: false, date: dateWhere }, select: { amount: true, driverId: true, employeeId: true, vehicleId: true, category: { select: { nameAr: true, nameEn: true } } } }),
    prisma.driverViolation.findMany({ where: { companyId, date: dateWhere }, select: { driverId: true, amount: true } }),
    prisma.companyPayment.aggregate({ where: { companyId, month, year }, _sum: { netReceived: true } }),
  ]);
  if (!company || company.type !== "DELIVERY") redirect(`/dashboard/companies/${companyId}/reports`);

  const driverIds = new Set(drivers.map((driver) => driver.id));
  const byEmployee = new Map(drivers.map((driver) => [driver.employee.id, driver.id]));
  const byVehicle = new Map(drivers.filter((driver) => driver.assignedVehicleId).map((driver) => [driver.assignedVehicleId!, driver.id]));
  const ordersByDriver = new Map<string, number>();
  orders.forEach((order) => ordersByDriver.set(order.driverId, (ordersByDriver.get(order.driverId) ?? 0) + order.ordersCount));
  const salariesByEmployee = new Map(salaries.map((salary) => [salary.employeeId, salary]));
  const directCosts = new Map<string, Costs>(); const sharedCosts = zeroCosts();
  for (const expense of expenses) {
    const key = classifyExpense(`${expense.category.nameAr} ${expense.category.nameEn ?? ""}`);
    if (!key) continue;
    const driverId = expense.driverId ?? (expense.employeeId ? byEmployee.get(expense.employeeId) : undefined) ?? (expense.vehicleId ? byVehicle.get(expense.vehicleId) : undefined);
    if (driverId) { const costs = directCosts.get(driverId) ?? zeroCosts(); costs[key] += amount(expense.amount); directCosts.set(driverId, costs); } else sharedCosts[key] += amount(expense.amount);
  }
  for (const salary of salaries) if (!byEmployee.has(salary.employeeId)) sharedCosts.admin += amount(salary.netAmount);
  const violationsByDriver = new Map<string, number>();
  violations.forEach((violation) => { if (violation.driverId && driverIds.has(violation.driverId)) violationsByDriver.set(violation.driverId, (violationsByDriver.get(violation.driverId) ?? 0) + amount(violation.amount)); });
  const totalOrders = Array.from(ordersByDriver.values()).reduce((sum, value) => sum + value, 0);
  const sharedTotal = Object.values(sharedCosts).reduce((sum, value) => sum + value, 0);
  const totalIncentives = salaries.reduce((sum, salary) => sum + amount(salary.incentives), 0);
  const perDriver = drivers.map((driver) => {
    const riderOrders = ordersByDriver.get(driver.id) ?? 0;
    const ratio = totalOrders ? riderOrders / totalOrders : 0;
    const direct = directCosts.get(driver.id) ?? zeroCosts();
    const cost = (key: CostKey) => direct[key] + sharedCosts[key] * ratio;
    return { driver, riderOrders, salary: salariesByEmployee.get(driver.employee.id), cost, violations: violationsByDriver.get(driver.id) ?? 0 };
  });
  const companyName = locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr;
  const period = new Intl.DateTimeFormat(numberLocale, { month: "long", year: "numeric" }).format(start);
  const money = (value: number) => value ? formatKWD(value, numberLocale) : "—";
  const isEnglish = locale === "en";

  return <div><Header title={isEnglish ? "Cost Center" : "مركز التكلفة"} subtitle={`${companyName} — ${period}`} companyId={companyId} /><div className="page-container space-y-4">
    <CostCenterFilters companyId={companyId} defaultMonth={now.getMonth() + 1} defaultYear={now.getFullYear()} locale={locale} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5"><Stat icon={PackageCheck} label={isEnglish ? "Total orders" : "إجمالي الطلبات"} value={totalOrders.toLocaleString(numberLocale)} color="text-blue-600" /><Stat icon={TrendingUp} label={isEnglish ? "Platform receipts" : "تحصيل المنصات"} value={formatKWD(amount(received._sum.netReceived), numberLocale)} color="text-emerald-600" /><Stat icon={Users} label={isEnglish ? "Incentives" : "الحوافز"} value={formatKWD(totalIncentives, numberLocale)} color="text-orange-600" /><Stat icon={Building2} label={isEnglish ? "Shared costs" : "التكاليف المشتركة"} value={formatKWD(sharedTotal, numberLocale)} color="text-violet-600" /><Stat icon={Calculator} label={isEnglish ? "Cost per order" : "تكلفة الطلب"} value={formatKWD(totalOrders ? sharedTotal / totalOrders : 0, numberLocale)} color="text-red-600" /></div>
    <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{isEnglish ? "Direct costs are assigned to the linked rider or vehicle. Shared costs are distributed according to each rider's share of monthly orders." : "المصروف المباشر يُحمّل على السائق أو السيارة المرتبطة به، أما المصروفات المشتركة فتوزع حسب نسبة طلبات كل سائق خلال الشهر."}</p>
    <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="ar-table min-w-[2200px] text-xs"><thead><tr>{HEADERS[locale].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{perDriver.length === 0 ? <tr><td colSpan={17} className="py-10 text-center text-muted-foreground">{isEnglish ? "No riders found for this period." : "لا توجد بيانات سائقين لهذه الفترة."}</td></tr> : perDriver.map(({ driver, riderOrders, salary, cost, violations: riderViolations }) => <tr key={driver.id}><td>{driver.employee.employeeNumber ?? driver.clientGeneratedId ?? "—"}</td><td className="font-medium">{isEnglish ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr}</td><td className="number">{riderOrders}</td><td>{salary?.targetOrders ?? driver.targetOrders}</td><td>{money(amount(salary?.incentives))}</td><td>{money(cost("housing"))}</td><td>{money(cost("food"))}</td><td>{money(cost("fuel"))}</td><td>{money(cost("residency"))}</td><td>{money(cost("vehicleRent"))}</td><td>{money(cost("maintenance"))}</td><td>{money(riderViolations)}</td><td>{money(cost("phone"))}</td><td>{money(cost("health"))}</td><td>{money(cost("advertising"))}</td><td>{money(cost("office"))}</td><td>{money(cost("admin"))}</td></tr>)}</tbody></table></div></div>
  </div></div>;
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) { return <div className="stat-card"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon size={16} className={color} />{label}</div><p className={`number text-xl font-bold ${color}`}>{value}</p></div>; }
