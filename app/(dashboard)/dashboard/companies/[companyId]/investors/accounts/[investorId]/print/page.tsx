import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { PrintButton } from "@/components/ui/print-button";
import { formatDate, formatKWD, formatMonthYear, toNumber } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; investorId: string }>;
}

export default async function InvestorAccountPrintPage({ params }: Props) {
  const { companyId, investorId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const canView = session.isSuperAdmin
    || hasPermission(session, "INVESTOR_STATEMENTS", "PRINT", { companyId })
    || hasPermission(session, "INVESTORS", "VIEW", { companyId });
  if (!canView) notFound();

  const [investor, agreements, claims, salaryCollections] = await Promise.all([
    prisma.investor.findUnique({ where: { id: investorId }, select: { id: true, nameAr: true, phone: true } }),
    prisma.investorAccountAgreement.findMany({
      where: { companyId, investorId },
      include: {
        branch: { select: { nameAr: true } },
        license: { select: { commercialNameAr: true, licenseNumber: true } },
      },
      orderBy: [{ isActive: "desc" }, { titleAr: "asc" }],
    }),
    prisma.investorClaim.findMany({
      where: { companyId, investorId },
      include: { lines: true },
      orderBy: { claimDate: "desc" },
    }),
    prisma.investorSalaryCollection.findMany({
      where: { companyId, investorId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    }),
  ]);

  if (!investor) notFound();

  const totalActual = claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + toNumber(line.actualAmount), 0), 0);
  const totalCollected = claims.reduce((sum, claim) => sum + claim.lines.reduce((inner, line) => inner + toNumber(line.collectedAmount), 0), 0);
  const salaryCollected = salaryCollections.reduce((sum, item) => sum + toNumber(item.collectedAmount), 0);

  return (
    <div className="min-h-screen bg-white p-8 text-black">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">كشف حساب المسئول / المدير</h1>
            <p className="mt-1 text-sm text-slate-600">{investor.nameAr}</p>
            {investor.phone && <p className="text-sm text-slate-600">{investor.phone}</p>}
          </div>
          <PrintButton label="طباعة" />
        </div>

        <div className="grid grid-cols-4 gap-4">
          <PrintCard label="إجمالي المطالبات" value={formatKWD(totalActual)} />
          <PrintCard label="المحصل من المطالبات" value={formatKWD(totalCollected)} />
          <PrintCard label="المتبقي" value={formatKWD(totalActual - totalCollected)} />
          <PrintCard label="محصل الرواتب" value={formatKWD(salaryCollected)} />
        </div>

        <section>
          <h2 className="mb-3 text-lg font-bold">الاتفاقيات المالية</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2 text-right">الاتفاق</th>
                <th className="border p-2 text-right">الفرع / الترخيص</th>
                <th className="border p-2 text-right">المبلغ</th>
                <th className="border p-2 text-right">الاستحقاق القادم</th>
                <th className="border p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((item) => (
                <tr key={item.id}>
                  <td className="border p-2">{item.titleAr}</td>
                  <td className="border p-2">{item.branch?.nameAr ?? "—"} {item.license ? `• ${item.license.licenseNumber}` : ""}</td>
                  <td className="border p-2">{formatKWD(item.amount.toString())}</td>
                  <td className="border p-2">{item.nextDueDate ? formatDate(item.nextDueDate) : "—"}</td>
                  <td className="border p-2">{item.isActive ? "نشط" : "موقوف"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">المطالبات</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2 text-right">التاريخ</th>
                <th className="border p-2 text-right">البيان</th>
                <th className="border p-2 text-right">المطلوب</th>
                <th className="border p-2 text-right">المحصل</th>
                <th className="border p-2 text-right">المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((claim) => {
                const actual = claim.lines.reduce((sum, line) => sum + toNumber(line.actualAmount), 0);
                const collected = claim.lines.reduce((sum, line) => sum + toNumber(line.collectedAmount), 0);
                return (
                  <tr key={claim.id}>
                    <td className="border p-2">{formatDate(claim.claimDate)}</td>
                    <td className="border p-2">{claim.descriptionAr}</td>
                    <td className="border p-2">{formatKWD(actual)}</td>
                    <td className="border p-2">{formatKWD(collected)}</td>
                    <td className="border p-2">{formatKWD(actual - collected)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">تحصيلات تمويل الرواتب</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-2 text-right">الفترة</th>
                <th className="border p-2 text-right">تاريخ التحصيل</th>
                <th className="border p-2 text-right">المبلغ</th>
                <th className="border p-2 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {salaryCollections.map((item) => (
                <tr key={item.id}>
                  <td className="border p-2">{formatMonthYear(item.month, item.year)}</td>
                  <td className="border p-2">{formatDate(item.collectedDate)}</td>
                  <td className="border p-2">{formatKWD(item.collectedAmount.toString())}</td>
                  <td className="border p-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function PrintCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
