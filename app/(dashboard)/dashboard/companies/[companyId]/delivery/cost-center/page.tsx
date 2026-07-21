import { redirect } from "next/navigation";
import { Building2, Calculator, PackageCheck, TrendingUp, Users } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";
import { CostCenterFilters } from "./filters";

interface Props { params: Promise<{ companyId: string }>; searchParams: Promise<{ month?: string; year?: string }>; }
type CostKey = "accommodation" | "food" | "fuel" | "visa" | "vehicleRent" | "maintenance" | "ticket" | "medical" | "phone" | "health" | "advertising" | "fixed" | "staff" | "legal" | "other";
type Amounts = Record<CostKey, number>;
const emptyAmounts = (): Amounts => ({ accommodation: 0, food: 0, fuel: 0, visa: 0, vehicleRent: 0, maintenance: 0, ticket: 0, medical: 0, phone: 0, health: 0, advertising: 0, fixed: 0, staff: 0, legal: 0, other: 0 });
const asNumber = (value: { toString(): string } | number | null | undefined) => Number(value ?? 0);

function getExpenseKey(name: string): CostKey {
  const value = name.toLowerCase();
  if (/accommodation|housing|سكن|إسكان|ايجار سكن/.test(value)) return "accommodation";
  if (/food|meal|طعام|غذاء|وجبات/.test(value)) return "food";
  if (/fuel|petrol|diesel|transportation|وقود|بنزين|نقل/.test(value)) return "fuel";
  if (/visa|residen|تأشيرة|فيزا|إقامة/.test(value)) return "visa";
  if (/vehicle.*rent|car.*rent|إيجار.*سيار|تأجير.*سيار/.test(value)) return "vehicleRent";
  if (/maintenance|repair|garage|صيانة|تصليح|كراج/.test(value)) return "maintenance";
  if (/ticket|airfare|تذكرة|سفر/.test(value)) return "ticket";
  if (/medical|clinic|hospital|طبي|علاج/.test(value)) return "medical";
  if (/phone|sim|mobile|gps|هاتف|شريحة|جوال/.test(value)) return "phone";
  if (/health card|بطاقة صحية/.test(value)) return "health";
  if (/advertis|marketing|إعلان|دعاية/.test(value)) return "advertising";
  if (/office|electric|water|utility|مكتب|كهرباء|مياه|مرافق/.test(value)) return "fixed";
  if (/staff|admin salary|رواتب.*إدار|موظفين/.test(value)) return "staff";
  if (/social|legal|insurance|تأمينات|قانون/.test(value)) return "legal";
  return "other";
}

export default async function CostCenterReportPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const now = new Date();
  const month = sp.month === "" ? 0 : Number(sp.month ?? now.getMonth() + 1);
  const year = sp.year === "" ? 0 : Number(sp.year ?? now.getFullYear());
  const startDate = new Date(year || now.getFullYear(), month ? month - 1 : 0, 1);
  const endDate = month ? new Date(year || now.getFullYear(), month, 1) : new Date((year || now.getFullYear()) + 1, 0, 1);
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateWhere = { gte: startDate, lt: endDate };

  const [company, drivers, dailyOrders, salaryPayments, expenses, received] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true, nameEn: true, type: true } }),
    prisma.driver.findMany({ where: { employee: { companyId, isDeleted: false } }, include: { employee: { select: { id: true, nameAr: true, nameEn: true, employeeNumber: true, baseSalary: true } }, assignedVehicle: { select: { id: true, plateNumber: true, ownershipModel: true } } }, orderBy: { employee: { nameAr: "asc" } } }),
    prisma.deliveryDailyOrder.findMany({ where: { companyId, date: dateWhere }, select: { driverId: true, ordersCount: true, grossAmount: true, ratePerOrder: true } }),
    prisma.salaryPayment.findMany({ where: { employee: { companyId }, batch: { ...(month ? { month } : {}), year: year || now.getFullYear() } }, select: { employeeId: true, baseAmount: true, incentives: true, additionalEarnings: true, netAmount: true, targetOrders: true } }),
    prisma.expense.findMany({ where: { companyId, isDeleted: false, date: dateWhere }, select: { amount: true, driverId: true, employeeId: true, vehicleId: true, category: { select: { nameAr: true, nameEn: true } } } }),
    prisma.companyPayment.aggregate({ where: { companyId, ...(month ? { month } : {}), year: year || now.getFullYear() }, _sum: { netReceived: true } }),
  ]);
  if (!company || company.type !== "DELIVERY") redirect(`/dashboard/companies/${companyId}/reports`);

  const ordersByDriver = new Map<string, { orders: number; gross: number; rateSum: number; rateCount: number }>();
  for (const order of dailyOrders) { const item = ordersByDriver.get(order.driverId) ?? { orders: 0, gross: 0, rateSum: 0, rateCount: 0 }; item.orders += order.ordersCount; item.gross += asNumber(order.grossAmount); if (order.ratePerOrder) { item.rateSum += asNumber(order.ratePerOrder); item.rateCount++; } ordersByDriver.set(order.driverId, item); }
  const salaryByEmployee = new Map(salaryPayments.map((payment) => [payment.employeeId, payment]));
  const driverByEmployee = new Map(drivers.map((driver) => [driver.employee.id, driver.id]));
  const driverByVehicle = new Map(drivers.filter((driver) => driver.assignedVehicleId).map((driver) => [driver.assignedVehicleId!, driver.id]));
  const directCosts = new Map<string, Amounts>(); const sharedCosts = emptyAmounts();
  for (const expense of expenses) { const key = getExpenseKey(`${expense.category.nameAr} ${expense.category.nameEn ?? ""}`); const driverId = expense.driverId ?? (expense.employeeId ? driverByEmployee.get(expense.employeeId) : undefined) ?? (expense.vehicleId ? driverByVehicle.get(expense.vehicleId) : undefined); if (driverId) { const totals = directCosts.get(driverId) ?? emptyAmounts(); totals[key] += asNumber(expense.amount); directCosts.set(driverId, totals); } else sharedCosts[key] += asNumber(expense.amount); }
  const totalOrders = Array.from(ordersByDriver.values()).reduce((sum, value) => sum + value.orders, 0);
  const sharedTotal = Object.values(sharedCosts).reduce((sum, value) => sum + value, 0);
  const directTotal = Array.from(directCosts.values()).reduce((sum, value) => sum + Object.values(value).reduce((subTotal, amount) => subTotal + amount, 0), 0);
  const totalSalary = salaryPayments.reduce((sum, value) => sum + asNumber(value.netAmount), 0);
  const rows = drivers.map((driver) => { const operation = ordersByDriver.get(driver.id) ?? { orders: 0, gross: 0, rateSum: 0, rateCount: 0 }; const salary = salaryByEmployee.get(driver.employee.id); const direct = directCosts.get(driver.id) ?? emptyAmounts(); const ratio = totalOrders ? operation.orders / totalOrders : 0; const shared = Object.fromEntries(Object.entries(sharedCosts).map(([key, amount]) => [key, amount * ratio])) as Amounts; const totalCost = asNumber(salary?.netAmount) + Object.values(direct).reduce((sum, amount) => sum + amount, 0) + Object.values(shared).reduce((sum, amount) => sum + amount, 0); return { driver, operation, salary, direct, shared, totalCost }; });
  const companyName = locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr;
  const period = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-KW", { month: "long", year: "numeric" }).format(startDate);
  const money = (value: number) => value ? formatKWD(value, numberLocale) : "—";

  return <div><Header title={locale === "en" ? "Cost Center" : "مركز التكلفة"} subtitle={`${companyName} — ${period}`} companyId={companyId} /><div className="page-container space-y-4">
    <CostCenterFilters companyId={companyId} defaultMonth={now.getMonth() + 1} defaultYear={now.getFullYear()} />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5"><Stat icon={PackageCheck} label="إجمالي الطلبات" value={totalOrders.toLocaleString(numberLocale)} color="text-blue-600" /><Stat icon={TrendingUp} label="صافي تحصيل المنصات" value={formatKWD(asNumber(received._sum.netReceived), numberLocale)} color="text-emerald-600" /><Stat icon={Users} label="رواتب السائقين" value={formatKWD(totalSalary, numberLocale)} color="text-orange-600" /><Stat icon={Building2} label="التكاليف المشتركة" value={formatKWD(sharedTotal, numberLocale)} color="text-violet-600" /><Stat icon={Calculator} label="تكلفة الطلب" value={formatKWD(totalOrders ? (totalSalary + directTotal + sharedTotal) / totalOrders : 0, numberLocale)} color="text-red-600" /></div>
    <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">يعتمد التقرير على الطلبات اليومية، مسيرات الرواتب، المصروفات المسجلة، المركبات والتحصيلات. المصروفات العامة توزع على السائقين بنسبة عدد الطلبات، بينما المصروف المرتبط بسائق أو سيارة يحمل مباشرة عليه.</div>
    <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="ar-table min-w-[3000px] text-xs"><thead><tr>{["الرقم الوظيفي","اسم السائق","الكود","المركبة","إجمالي الطلبات","راتب ثابت","راتب لكل طلب","هدف الحوافز","الحوافز","إجمالي الاستحقاق","صافي راتب السائق","سكن — المسؤول","السكن","غذاء — المسؤول","الغذاء","وقود/نقل — المسؤول","وقود/نقل","إقامة/فيزا — المسؤول","إقامة/فيزا","ملكية المركبة","إيجار المركبة — المسؤول","إيجار المركبة","صيانة — المسؤول","صيانة","تذاكر — المسؤول","تذاكر","دعم طبي — المسؤول","دعم طبي","هاتف/شريحة/GPS — المسؤول","هاتف/شريحة/GPS","بطاقة صحية — المسؤول","بطاقة صحية","إعلان — المسؤول","إعلان","تكاليف ثابتة — المسؤول","تكاليف ثابتة","رواتب الموظفين — المسؤول","رواتب الموظفين","قانوني وتأمينات — المسؤول","قانوني وتأمينات","إجمالي تكلفة السائق"].map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan={41} className="py-10 text-center text-muted-foreground">لا توجد بيانات سائقين في هذه الفترة.</td></tr> : rows.map(({ driver, operation, salary, direct, shared, totalCost }) => { const cost = (key: CostKey) => direct[key] + shared[key]; const cell = (key: CostKey) => <><td>{cost(key) ? "الشركة" : "—"}</td><td className="number">{money(cost(key))}</td></>; return <tr key={driver.id}><td>{driver.employee.employeeNumber ?? driver.clientGeneratedId ?? "—"}</td><td className="font-medium">{locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr}</td><td>{driver.talabatId ?? driver.roPopsId ?? "—"}</td><td>{driver.assignedVehicle?.plateNumber ?? "—"}</td><td className="number">{operation.orders}</td><td>{formatKWD(asNumber(salary?.baseAmount ?? driver.employee.baseSalary), numberLocale)}</td><td>{operation.orders ? money(operation.rateCount ? operation.rateSum / operation.rateCount : operation.gross / operation.orders) : "—"}</td><td>{salary?.targetOrders ?? driver.targetOrders}</td><td>{money(asNumber(salary?.incentives))}</td><td>{formatKWD(asNumber(salary?.baseAmount) + asNumber(salary?.incentives) + asNumber(salary?.additionalEarnings), numberLocale)}</td><td className="font-bold">{money(asNumber(salary?.netAmount))}</td>{cell("accommodation")}{cell("food")}{cell("fuel")}{cell("visa")}<td>{driver.assignedVehicle?.ownershipModel === "RENTED" ? "إيجار" : driver.assignedVehicle ? "تملك" : "—"}</td>{cell("vehicleRent")}{cell("maintenance")}{cell("ticket")}{cell("medical")}{cell("phone")}{cell("health")}{cell("advertising")}{cell("fixed")}{cell("staff")}{cell("legal")}<td className="number font-bold text-red-600">{money(totalCost)}</td></tr>; })}
    </tbody></table></div></div>
  </div></div>;
}

function Stat({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: string; color: string }) { return <div className="stat-card"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Icon size={16} className={color} />{label}</div><p className={`number text-xl font-bold ${color}`}>{value}</p></div>; }
