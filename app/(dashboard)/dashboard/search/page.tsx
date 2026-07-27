import Link from "next/link";
import { FileText, Search, UserRound, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

interface Props {
  searchParams: Promise<{
    q?: string;
    type?: string;
    companyId?: string;
  }>;
}

type SearchType = "all" | "licenses" | "investors" | "employees";

function normalizeSearchType(value: string | undefined): SearchType {
  if (value === "licenses" || value === "investors" || value === "employees") return value;
  return "all";
}

function canViewEmployees(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, companyId: string) {
  return hasPermission(session, "HR", "VIEW", { companyId })
    || hasPermission(session, "DELIVERY_HR", "VIEW", { companyId })
    || hasPermission(session, "CAR_WASH_HR", "VIEW", { companyId });
}

export default async function GroupSearchPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const locale = await getLocale();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const activeType = normalizeSearchType(params.type);

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(session.isSuperAdmin ? {} : { id: { in: session.companyAccess } }),
    },
    select: { id: true, nameAr: true, nameEn: true, type: true, group: { select: { id: true, nameAr: true, nameEn: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const validCompanyIds = new Set(companies.map((company) => company.id));
  const selectedCompanyId = params.companyId && validCompanyIds.has(params.companyId) ? params.companyId : "";
  const scopedCompanies = selectedCompanyId ? companies.filter((company) => company.id === selectedCompanyId) : companies;

  const licenseCompanyIds = scopedCompanies
    .filter((company) => hasPermission(session, "LICENSES", "VIEW", { companyId: company.id }))
    .map((company) => company.id);

  const investorCompanyIds = scopedCompanies
    .filter((company) => hasPermission(session, "INVESTORS", "VIEW", { companyId: company.id }))
    .map((company) => company.id);

  const employeeCompanyIds = scopedCompanies
    .filter((company) => canViewEmployees(session, company.id))
    .map((company) => company.id);

  const shouldSearch = query.length >= 2;

  const [licenses, investors, employees] = shouldSearch
    ? await Promise.all([
        activeType === "all" || activeType === "licenses"
          ? prisma.license.findMany({
              where: {
                companyId: { in: licenseCompanyIds.length > 0 ? licenseCompanyIds : ["__none__"] },
                OR: [
                  { commercialNameAr: { contains: query } },
                  { commercialNameEn: { contains: query } },
                  { licenseNumber: { contains: query } },
                ],
              },
              select: {
                id: true,
                companyId: true,
                commercialNameAr: true,
                commercialNameEn: true,
                licenseNumber: true,
                status: true,
                isMainLicense: true,
                branch: { select: { id: true, nameAr: true, nameEn: true } },
                investor: { select: { id: true, nameAr: true, nameEn: true } },
                _count: { select: { employees: true, branchLicenses: true } },
              },
              orderBy: [{ commercialNameAr: "asc" }],
              take: 40,
            })
          : Promise.resolve([]),
        activeType === "all" || activeType === "investors"
          ? prisma.investor.findMany({
              where: {
                isActive: true,
                companies: { some: { id: { in: investorCompanyIds.length > 0 ? investorCompanyIds : ["__none__"] } } },
                OR: [
                  { nameAr: { contains: query } },
                  { nameEn: { contains: query } },
                  { phone: { contains: query } },
                  { civilId: { contains: query } },
                ],
              },
              select: {
                id: true,
                nameAr: true,
                nameEn: true,
                phone: true,
                civilId: true,
                companies: {
                  where: { id: { in: investorCompanyIds.length > 0 ? investorCompanyIds : ["__none__"] } },
                  select: { id: true, nameAr: true, nameEn: true },
                },
                investorBranches: {
                  where: { isActive: true, branch: { companyId: { in: investorCompanyIds.length > 0 ? investorCompanyIds : ["__none__"] } } },
                  select: {
                    id: true,
                    branch: { select: { id: true, nameAr: true, nameEn: true } },
                  },
                },
              },
              orderBy: [{ nameAr: "asc" }],
              take: 40,
            })
          : Promise.resolve([]),
        activeType === "all" || activeType === "employees"
          ? prisma.employee.findMany({
              where: {
                companyId: { in: employeeCompanyIds.length > 0 ? employeeCompanyIds : ["__none__"] },
                isDeleted: false,
                OR: [
                  { nameAr: { contains: query } },
                  { nameEn: { contains: query } },
                  { employeeNumber: { contains: query } },
                  { phone: { contains: query } },
                  { civilId: { contains: query } },
                ],
              },
              select: {
                id: true,
                companyId: true,
                nameAr: true,
                nameEn: true,
                type: true,
                employeeNumber: true,
                phone: true,
                branch: { select: { id: true, nameAr: true, nameEn: true } },
                investor: { select: { id: true, nameAr: true, nameEn: true } },
                license: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
              },
              orderBy: [{ nameAr: "asc" }],
              take: 40,
            })
          : Promise.resolve([]),
      ])
    : [[], [], []];

  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const totalResults = licenses.length + investors.length + employees.length;

  const text = {
    title: locale === "en" ? "Global Search" : "البحث العام",
    subtitle: locale === "en"
      ? "Search licenses, investors, and employees across the companies you can access."
      : "ابحث عن التراخيص والمسئولين والموظفين عبر الشركات المسموح لك بها.",
    placeholder: locale === "en" ? "Search by name, number, phone..." : "ابحث بالاسم أو الرقم أو الجوال...",
    type: locale === "en" ? "Entity type" : "نوع السجل",
    company: locale === "en" ? "Company" : "الشركة",
    search: locale === "en" ? "Search" : "بحث",
    clear: locale === "en" ? "Clear filters" : "مسح الفلاتر",
    all: locale === "en" ? "All" : "الكل",
    licenses: locale === "en" ? "Licenses" : "التراخيص",
    investors: locale === "en" ? "Investors" : "المسئولون",
    employees: locale === "en" ? "Employees" : "الموظفون",
    allCompanies: locale === "en" ? "All companies" : "كل الشركات",
    activeOnly: locale === "en" ? "Only active, visible records are returned." : "يتم عرض السجلات النشطة والمسموح بها فقط.",
    startHint: locale === "en" ? "Enter at least 2 characters to start searching." : "اكتب حرفين على الأقل لبدء البحث.",
    noResults: locale === "en" ? "No matching results found." : "لا توجد نتائج مطابقة.",
    companyLabel: locale === "en" ? "Company" : "الشركة",
    branchLabel: locale === "en" ? "Branch" : "الفرع",
    investorLabel: locale === "en" ? "Investor" : "المسئول",
    licenseLabel: locale === "en" ? "License" : "الترخيص",
    phoneLabel: locale === "en" ? "Phone" : "الجوال",
    statusLabel: locale === "en" ? "Status" : "الحالة",
    linkedCompanies: locale === "en" ? "Linked companies" : "الشركات المرتبط بها",
    linkedBranches: locale === "en" ? "Linked branches" : "الفروع المرتبط بها",
    employeesCount: locale === "en" ? "Employees" : "الموظفون",
    subLicensesCount: locale === "en" ? "Sub-licenses" : "التراخيص الفرعية",
    noBranch: locale === "en" ? "No branch" : "بدون فرع",
    noInvestor: locale === "en" ? "No investor" : "بدون مسئول",
    noLicense: locale === "en" ? "No license" : "بدون ترخيص",
    viewDetails: locale === "en" ? "View details" : "عرض التفاصيل",
    results: locale === "en" ? `${totalResults} result(s)` : `${totalResults} نتيجة`,
  };

  return (
    <div>
      <Header title={text.title} subtitle={text.subtitle} />

      <div className="page-container space-y-6">
        <section className="rounded-2xl border bg-card p-5">
          <form className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_auto]">
            <label className="space-y-1">
              <span className="text-sm text-muted-foreground">{text.search}</span>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" name="q" defaultValue={query} placeholder={text.placeholder} className="input-field w-full pr-9" />
              </div>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-muted-foreground">{text.type}</span>
              <select name="type" defaultValue={activeType} className="input-field w-full">
                <option value="all">{text.all}</option>
                <option value="licenses">{text.licenses}</option>
                <option value="investors">{text.investors}</option>
                <option value="employees">{text.employees}</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-sm text-muted-foreground">{text.company}</span>
              <select name="companyId" defaultValue={selectedCompanyId} className="input-field w-full">
                <option value="">{text.allCompanies}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr} — {locale === "en" ? company.group.nameEn ?? company.group.nameAr : company.group.nameAr}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
                {text.search}
              </button>
              <Link href="/dashboard/search" className="rounded-lg border px-4 py-2 text-sm hover:bg-muted">
                {text.clear}
              </Link>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">{text.activeOnly}</p>
        </section>

        {!shouldSearch ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">{text.startHint}</div>
        ) : totalResults === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">{text.noResults}</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{text.results}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">{text.licenses}: {licenses.length}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">{text.investors}: {investors.length}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">{text.employees}: {employees.length}</span>
            </div>

            {licenses.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-amber-600" />
                  <h2 className="text-base font-bold">{text.licenses}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {licenses.map((license) => {
                    const company = companyMap.get(license.companyId);
                    return (
                      <div key={license.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">{locale === "en" ? license.commercialNameEn ?? license.commercialNameAr : license.commercialNameAr}</h3>
                            <p className="text-sm text-muted-foreground">{license.licenseNumber}</p>
                          </div>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                            {license.isMainLicense ? (locale === "en" ? "Main" : "رئيسي") : (locale === "en" ? "Branch" : "فرعي")}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <p><span className="text-muted-foreground">{text.companyLabel}: </span>{company ? (locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr) : "—"}</p>
                          <p><span className="text-muted-foreground">{text.branchLabel}: </span>{license.branch ? (locale === "en" ? license.branch.nameEn ?? license.branch.nameAr : license.branch.nameAr) : text.noBranch}</p>
                          <p><span className="text-muted-foreground">{text.investorLabel}: </span>{license.investor ? (locale === "en" ? license.investor.nameEn ?? license.investor.nameAr : license.investor.nameAr) : text.noInvestor}</p>
                          <p><span className="text-muted-foreground">{text.statusLabel}: </span>{license.status}</p>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-muted px-2 py-1">{text.employeesCount}: {license._count.employees}</span>
                          <span className="rounded-full bg-muted px-2 py-1">{text.subLicensesCount}: {license._count.branchLicenses}</span>
                        </div>

                        <div className="mt-4">
                          <Link href={`/dashboard/companies/${license.companyId}/licenses/${license.id}`} className="text-sm font-medium text-primary hover:underline">
                            {text.viewDetails}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {investors.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-teal-600" />
                  <h2 className="text-base font-bold">{text.investors}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {investors.map((investor) => (
                    <div key={investor.id} className="rounded-xl border bg-card p-4">
                      <div>
                        <h3 className="font-bold">{locale === "en" ? investor.nameEn ?? investor.nameAr : investor.nameAr}</h3>
                        {investor.phone ? <p className="text-sm text-muted-foreground">{text.phoneLabel}: {investor.phone}</p> : null}
                        {investor.civilId ? <p className="text-sm text-muted-foreground">{investor.civilId}</p> : null}
                      </div>

                      <div className="mt-3">
                        <p className="mb-2 text-xs text-muted-foreground">{text.linkedCompanies}</p>
                        <div className="flex flex-wrap gap-2">
                          {investor.companies.map((company) => (
                            <Link key={`${investor.id}-${company.id}`} href={`/dashboard/companies/${company.id}/investors/${investor.id}`} className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-muted/80">
                              {locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {investor.investorBranches.length > 0 && (
                        <div className="mt-3">
                          <p className="mb-2 text-xs text-muted-foreground">{text.linkedBranches}</p>
                          <div className="flex flex-wrap gap-2">
                            {investor.investorBranches.map((item) => (
                              <span key={item.id} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
                                {locale === "en" ? item.branch.nameEn ?? item.branch.nameAr : item.branch.nameAr}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {employees.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <h2 className="text-base font-bold">{text.employees}</h2>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {employees.map((employee) => {
                    const company = companyMap.get(employee.companyId);
                    return (
                      <div key={employee.id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold">{locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr}</h3>
                            <p className="text-sm text-muted-foreground">{employee.type}</p>
                          </div>
                          {employee.employeeNumber ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{employee.employeeNumber}</span> : null}
                        </div>

                        <div className="mt-3 grid gap-2 text-sm">
                          <p><span className="text-muted-foreground">{text.companyLabel}: </span>{company ? (locale === "en" ? company.nameEn ?? company.nameAr : company.nameAr) : "—"}</p>
                          <p><span className="text-muted-foreground">{text.branchLabel}: </span>{employee.branch ? (locale === "en" ? employee.branch.nameEn ?? employee.branch.nameAr : employee.branch.nameAr) : text.noBranch}</p>
                          <p><span className="text-muted-foreground">{text.investorLabel}: </span>{employee.investor ? (locale === "en" ? employee.investor.nameEn ?? employee.investor.nameAr : employee.investor.nameAr) : text.noInvestor}</p>
                          <p><span className="text-muted-foreground">{text.licenseLabel}: </span>{employee.license ? `${employee.license.commercialNameAr} (${employee.license.licenseNumber})` : text.noLicense}</p>
                          {employee.phone ? <p><span className="text-muted-foreground">{text.phoneLabel}: </span>{employee.phone}</p> : null}
                        </div>

                        <div className="mt-4">
                          <Link href={`/dashboard/companies/${employee.companyId}/hr/employees/${employee.id}`} className="text-sm font-medium text-primary hover:underline">
                            {text.viewDetails}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
