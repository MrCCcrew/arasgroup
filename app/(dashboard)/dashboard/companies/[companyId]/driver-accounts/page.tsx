import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Plus, UserRoundPlus, XCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";

export default async function DriverAccountsPage(props: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await props.params;
  const locale = await getLocale();
  const en = locale === "en";
  const canView = hasPermission(session, "EMPLOYEES", "VIEW", { companyId });
  const canCreate = hasPermission(session, "EMPLOYEES", "CREATE", { companyId });

  if (!canView) return <div className="page-container py-6 text-sm text-muted-foreground">{en ? "You are not authorized to view driver accounts." : "غير مصرح لك بعرض حسابات السائقين."}</div>;

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { nameAr: true, nameEn: true, type: true } });
  if (!company) return <div className="page-container py-6 text-sm text-muted-foreground">{en ? "Company not found." : "الشركة غير موجودة."}</div>;

  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, type: { in: company.type === "CAR_WASH" ? ["CAR_WASH_DRIVER", "CAR_WASH_WORKER"] : ["DRIVER", "DELIVERY_DRIVER"] } },
    include: { user: { select: { email: true } } },
    orderBy: { nameAr: "asc" },
  });

  const createHref = `/dashboard/companies/${companyId}/driver-accounts/create`;
  const title = en ? "Driver Accounts" : "حسابات السائقين";

  return (
    <div>
      <Header
        title={title}
        subtitle={en ? "Manage driver and car-wash worker access to the employee portal" : "إدارة حسابات دخول السائقين وعمال الغسيل إلى بوابة الموظف"}
        companyId={companyId}
        actions={canCreate ? <Link href={createHref} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus size={16} />{en ? "Create driver account" : "إنشاء حساب سائق"}</Link> : undefined}
      />

      <div className="page-container space-y-4">
        {employees.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground"><UserRoundPlus size={28} /></div>
              <div><h2 className="font-semibold text-foreground">{en ? "No driver accounts" : "لا توجد حسابات سائقين"}</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">{en ? "Create an account for a driver or car-wash worker so they can use the employee portal." : "ابدأ بإنشاء حساب لسائق أو عامل غسيل حتى يتمكن من استخدام بوابة الموظف"}</p></div>
              {canCreate && <Link href={createHref} className="mt-1 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus size={16} />{en ? "Create first account" : "إنشاء أول حساب"}</Link>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee) => {
              const hasAccount = Boolean(employee.user);
              const driverLabel = employee.type === "CAR_WASH_WORKER" ? (en ? "Car-wash worker" : "عامل غسيل") : (en ? "Driver" : "سائق");
              return <Card key={employee.id} className="transition-shadow hover:shadow-md"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-foreground">{en ? employee.nameEn ?? employee.nameAr : employee.nameAr}</h2><p className="mt-1 text-sm text-muted-foreground">{driverLabel}{employee.employeeNumber ? ` · ${employee.employeeNumber}` : ""}</p></div><span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${hasAccount ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{hasAccount ? <CheckCircle2 size={13} /> : <XCircle size={13} />}{hasAccount ? (en ? "Active account" : "لديه حساب") : (en ? "No account" : "بدون حساب")}</span></div>{hasAccount ? <p className="text-sm text-muted-foreground">{employee.user?.email}</p> : canCreate ? <Link href={`${createHref}?employeeId=${employee.id}`} className="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">{en ? "Create account" : "إنشاء حساب"}</Link> : null}</CardContent></Card>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
