import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{
    type?: string;
    positionId?: string;
    search?: string;
    group?: string;
    status?: string;
    category?: string;
  }>;
}

const typeLabels = {
  ar: {
    DRIVER: "سائق",
    DELIVERY_DRIVER: "سائق توصيل",
    DELIVERY_ADMIN: "إداري توصيل",
    CAR_WASH_DRIVER: "سائق غسيل",
    CAR_WASH_WORKER: "عامل غسيل",
    OFFICE_EMPLOYEE: "موظف مكتب",
    ACCOUNTANT: "محاسب",
    MANDOUB: "مندوب",
    OFFICE_BOY: "فراش",
    OTHER: "أخرى",
  },
  en: {
    DRIVER: "Driver",
    DELIVERY_DRIVER: "Delivery Driver",
    DELIVERY_ADMIN: "Delivery Admin",
    CAR_WASH_DRIVER: "Car Wash Driver",
    CAR_WASH_WORKER: "Car Wash Worker",
    OFFICE_EMPLOYEE: "Office Employee",
    ACCOUNTANT: "Accountant",
    MANDOUB: "Mandoub",
    OFFICE_BOY: "Office Boy",
    OTHER: "Other",
  },
} as const;

const DRIVER_TYPES = ["DRIVER", "DELIVERY_DRIVER", "CAR_WASH_DRIVER"] as const;
const ADMIN_TYPES = ["DELIVERY_ADMIN", "OFFICE_EMPLOYEE", "ACCOUNTANT", "MANDOUB", "OFFICE_BOY", "OTHER"] as const;

type EmployeeType = keyof typeof typeLabels.ar;

export default async function EmployeesPrintPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";
  const dateLocale = locale === "en" ? "en-US" : "ar-KW";
  const isEnglish = locale === "en";
  const getTypeLabel = (type: EmployeeType) => typeLabels[locale][type];
  const showingDeleted = query.status === "deleted";

  const activeWhere = { companyId, isActive: true, isDeleted: false };
  const deletedWhere = { companyId, isDeleted: true };
  const baseWhere = showingDeleted ? deletedWhere : activeWhere;

  const groupFilter =
    query.group === "company"
      ? { investorId: null }
      : query.group === "investor"
        ? { investorId: { not: null } }
        : {};

  const categoryFilter =
    query.category === "drivers"
      ? { type: { in: [...DRIVER_TYPES] } }
      : query.category === "admins"
        ? { investorId: null, type: { in: [...ADMIN_TYPES] } }
        : query.category === "investor"
          ? { investorId: { not: null } }
          : {};

  const typeFilter = query.type ? { type: query.type as EmployeeType } : {};
  const positionFilter = query.positionId ? { positionId: query.positionId } : {};

  const [company, employees] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true, logoUrl: true },
    }),
    prisma.employee.findMany({
      where: {
        ...baseWhere,
        ...groupFilter,
        ...categoryFilter,
        ...typeFilter,
        ...positionFilter,
        ...(query.search ? { nameAr: { contains: query.search } } : {}),
      },
      include: {
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
        position: { select: { nameAr: true, nameEn: true } },
        license: { select: { commercialNameAr: true, commercialNameEn: true, managerName: true } },
        residencyLicense: { select: { commercialNameAr: true, commercialNameEn: true } },
        workPermitLicense: { select: { commercialNameAr: true, commercialNameEn: true } },
        driver: { select: { id: true, isRegisteredTalabat: true, isRegisteredRoPops: true, walletBalance: true } },
        carWashWorker: { select: { role: true } },
      },
      orderBy: showingDeleted ? [{ deletedAt: "desc" }, { nameAr: "asc" }] : [{ type: "asc" }, { nameAr: "asc" }],
    }),
  ]);

  const showInvestorColumn = (!query.group || query.group === "investor") && query.category !== "admins";

  // Build query for back button
  const backQuery = new URLSearchParams();
  if (query.type) backQuery.set("type", query.type);
  if (query.positionId) backQuery.set("positionId", query.positionId);
  if (query.search) backQuery.set("search", query.search);
  if (query.group) backQuery.set("group", query.group);
  if (query.status) backQuery.set("status", query.status);
  if (query.category) backQuery.set("category", query.category);

  const backHref = `/dashboard/companies/${companyId}/hr/employees${backQuery.toString() ? `?${backQuery.toString()}` : ""}`;
  const printDate = new Date().toLocaleDateString(numberLocale, { year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: ${isEnglish ? "ltr" : "rtl"}; background: #f5f5f5; font-size: 10pt; }
        .page { max-width: 297mm; margin: 2rem auto; background: white; padding: 1.5rem; border: 1px solid #d1d5db; }
        .header { text-align: center; border-bottom: 2px solid #1f2937; padding-bottom: 1rem; margin-bottom: 1.25rem; }
        .header-inner { display: flex; align-items: center; justify-content: center; gap: 0.75rem; }
        .company-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 8px; border: 1px solid #e5e7eb; padding: 4px; background: white; }
        .company-name { font-size: 1.3rem; font-weight: 700; color: #1f2937; }
        .report-title { font-size: 1.1rem; font-weight: 600; margin-top: 0.3rem; }
        .report-sub { font-size: 0.85rem; color: #6b7280; margin-top: 0.2rem; }
        .print-date { font-size: 0.78rem; color: #9ca3af; margin-top: 0.2rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.7rem; margin-top: 0.5rem; }
        th { background: #1f2937; color: white; padding: 0.4rem 0.3rem; text-align: ${isEnglish ? "left" : "right"}; border: 1px solid #1f2937; font-weight: 600; font-size: 0.68rem; }
        td { padding: 0.35rem 0.3rem; border: 1px solid #d1d5db; }
        tr:nth-child(even) td { background: #f9fafb; }
        .number { font-variant-numeric: tabular-nums; direction: ltr; text-align: left; }
        @media print {
          .controls { display: none !important; }
          body { background: white; }
          .page { border: none; padding: 0; margin: 0; max-width: 100%; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>

      <PrintControls backHref={backHref} />

      <div className="page">
        <div className="header">
          <div className="header-inner">
            {company?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.nameAr} className="company-logo" />
            )}
            <div>
              <p className="company-name">{isEnglish ? company?.nameEn ?? company?.nameAr : company?.nameAr}</p>
              {isEnglish && company?.nameAr && <p style={{ fontSize: "0.85rem", color: "#374151" }}>{company.nameAr}</p>}
            </div>
          </div>
          <p className="report-title">{isEnglish ? "Employees Report" : "تقرير الموظفين"}</p>
          <p className="report-sub">{employees.length} {isEnglish ? "employee(s)" : "موظف"}</p>
          <p className="print-date">{isEnglish ? "Print date" : "تاريخ الطباعة"}: {printDate}</p>
        </div>

        {employees.length === 0 ? (
          <p style={{ textAlign: "center", color: "#6b7280", padding: "2rem" }}>
            {isEnglish ? "No employees found" : "لا يوجد موظفون"}
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{isEnglish ? "No." : "الرقم"}</th>
                <th>{isEnglish ? "Name" : "الاسم"}</th>
                <th>{isEnglish ? "Civil ID" : "الرقم المدني"}</th>
                <th>{isEnglish ? "Residency expiry" : "انتهاء الإقامة"}</th>
                <th>{isEnglish ? "Position" : "الوظيفة"}</th>
                <th>{isEnglish ? "Salary" : "الراتب"}</th>
                {showInvestorColumn ? <th>{isEnglish ? "Investor" : "المسئول"}</th> : null}
                <th>{isEnglish ? "Residency license" : "ترخيص الإقامة"}</th>
                <th>{isEnglish ? "Work permit" : "ترخيص العمل"}</th>
                <th>{isEnglish ? "Phone" : "التليفون"}</th>
                <th>{isEnglish ? "Main license" : "الترخيص الرئيسي"}</th>
                <th>{isEnglish ? "Authorized signer" : "المفوض بالتوقيع"}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="number">{employee.employeeNumber ?? "—"}</td>
                  <td>
                    {employee.nameAr}
                    {employee.nameEn && <div style={{ fontSize: "0.65rem", color: "#6b7280", marginTop: "0.1rem" }}>{employee.nameEn}</div>}
                  </td>
                  <td className="number">{employee.civilId ?? "—"}</td>
                  <td>{employee.residencyExpiry ? formatDate(employee.residencyExpiry, dateLocale) : "—"}</td>
                  <td>
                    {employee.position
                      ? isEnglish
                        ? employee.position.nameEn ?? employee.position.nameAr
                        : employee.position.nameAr
                      : "—"}
                  </td>
                  <td className="number">{employee.baseSalary ? formatKWD(Number(employee.baseSalary), numberLocale) : "—"}</td>
                  {showInvestorColumn ? (
                    <td>
                      {employee.investor
                        ? isEnglish
                          ? employee.investor.nameEn ?? employee.investor.nameAr
                          : employee.investor.nameAr
                        : "—"}
                    </td>
                  ) : null}
                  <td>
                    {employee.residencyLicense
                      ? isEnglish
                        ? employee.residencyLicense.commercialNameEn ?? employee.residencyLicense.commercialNameAr
                        : employee.residencyLicense.commercialNameAr
                      : "—"}
                  </td>
                  <td>
                    {employee.workPermitLicense
                      ? isEnglish
                        ? employee.workPermitLicense.commercialNameEn ?? employee.workPermitLicense.commercialNameAr
                        : employee.workPermitLicense.commercialNameAr
                      : "—"}
                  </td>
                  <td className="number">{employee.phone ?? "—"}</td>
                  <td>
                    {employee.license
                      ? isEnglish
                        ? employee.license.commercialNameEn ?? employee.license.commercialNameAr
                        : employee.license.commercialNameAr
                      : "—"}
                  </td>
                  <td>{employee.license?.managerName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
