import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DeleteOperationButton } from "../DeleteOperationButton";

interface Props {
  params: Promise<{ companyId: string; operationId: string }>;
}

export default async function CarWashOperationDetailPage({ params }: Props) {
  const { companyId, operationId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const operation = await prisma.carWashDailyOperation.findUnique({
    where: { id: operationId },
    include: {
      vehicle: { select: { code: true, nameAr: true } },
      location: { select: { nameAr: true } },
      revenues: true,
      expenses: true,
      knetTransactions: {
        select: { id: true, amount: true, transactionRef: true, date: true },
      },
    },
  });

  if (!operation || operation.companyId !== companyId) notFound();

  return (
    <div>
      <Header
        title={`عملية ${new Date(operation.date).toLocaleDateString("ar-KW")}`}
        subtitle={`${operation.vehicle.nameAr} - ${operation.location.nameAr}`}
        companyId={companyId}
        actions={
          session.isSuperAdmin ? (
            <DeleteOperationButton
              operationId={operation.id}
              locale="ar"
              redirectTo={`/dashboard/companies/${companyId}/car-wash/operations`}
            />
          ) : undefined
        }
      />

      <div className="page-container max-w-4xl space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/car-wash/operations`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight size={14} />
          العودة للعمليات
        </Link>

        <div className="section-card">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">التاريخ</p>
              <p className="font-medium">{new Date(operation.date).toLocaleDateString("ar-KW")}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">السيارة</p>
              <p className="font-medium">
                {operation.vehicle.code} - {operation.vehicle.nameAr}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">الموقع</p>
              <p className="font-medium">{operation.location.nameAr}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">الحالة</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  operation.status === "CLOSED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {operation.status === "CLOSED" ? "مغلقة" : "مفتوحة"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "إجمالي الكاش", value: Number(operation.totalCash), color: "text-blue-600" },
            { label: "إجمالي KNET", value: Number(operation.totalKnet), color: "text-purple-600" },
            { label: "إجمالي المصروفات", value: Number(operation.totalExpenses), color: "text-red-600" },
            { label: "صافي الإيراد", value: Number(operation.netRevenue), color: "text-green-600" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border bg-card p-4">
              <p className="mb-1 text-xs text-muted-foreground">{item.label}</p>
              <p className={`number text-xl font-bold ${item.color}`}>{item.value.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">د.ك</p>
            </div>
          ))}
        </div>

        {operation.revenues.length > 0 && (
          <div>
            <h3 className="mb-3 font-bold">الإيرادات</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>البيان</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {operation.revenues.map((revenue) => (
                    <tr key={revenue.id}>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            revenue.type === "CASH" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {revenue.type === "CASH" ? "كاش" : "KNET"}
                        </span>
                      </td>
                      <td className="text-sm text-muted-foreground">{revenue.description ?? "-"}</td>
                      <td className="number font-bold">{Number(revenue.amount).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {operation.expenses.length > 0 && (
          <div>
            <h3 className="mb-3 font-bold">المصروفات</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>البيان</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {operation.expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="text-sm">{expense.description}</td>
                      <td className="number font-bold text-red-600">{Number(expense.amount).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {operation.knetTransactions.length > 0 && (
          <div>
            <h3 className="mb-3 font-bold">معاملات KNET</h3>
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="ar-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>رقم المرجع</th>
                    <th>المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {operation.knetTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="number text-xs text-muted-foreground">{new Date(transaction.date).toLocaleDateString("ar-KW")}</td>
                      <td className="number text-sm">{transaction.transactionRef ?? "-"}</td>
                      <td className="number font-bold text-purple-600">{Number(transaction.amount).toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {operation.notes && (
          <div className="section-card">
            <p className="mb-1 text-xs text-muted-foreground">ملاحظات</p>
            <p className="text-sm">{operation.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
