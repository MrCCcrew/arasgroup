import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
      />

      <div className="page-container max-w-4xl space-y-6">
        <Link
          href={`/dashboard/companies/${companyId}/car-wash/operations`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowRight size={14} />
          العودة للعمليات
        </Link>

        <div className="section-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">التاريخ</p>
              <p className="font-medium">{new Date(operation.date).toLocaleDateString("ar-KW")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">السيارة</p>
              <p className="font-medium">{operation.vehicle.code} - {operation.vehicle.nameAr}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">الموقع</p>
              <p className="font-medium">{operation.location.nameAr}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">الحالة</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                operation.status === "CLOSED" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
              }`}>
                {operation.status === "CLOSED" ? "مغلقة" : "مفتوحة"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "إجمالي الكاش", value: Number(operation.totalCash), color: "text-blue-600" },
            { label: "إجمالي KNET", value: Number(operation.totalKnet), color: "text-purple-600" },
            { label: "إجمالي المصروفات", value: Number(operation.totalExpenses), color: "text-red-600" },
            { label: "صافي الإيراد", value: Number(operation.netRevenue), color: "text-green-600" },
          ].map((item) => (
            <div key={item.label} className="bg-card border rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className={`text-xl font-bold number ${item.color}`}>{item.value.toFixed(3)}</p>
              <p className="text-xs text-muted-foreground">د.ك</p>
            </div>
          ))}
        </div>

        {operation.revenues.length > 0 && (
          <div>
            <h3 className="font-bold mb-3">الإيرادات</h3>
            <div className="bg-card border rounded-xl overflow-hidden">
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
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          revenue.type === "CASH" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                        }`}>
                          {revenue.type === "CASH" ? "كاش" : "KNET"}
                        </span>
                      </td>
                      <td className="text-sm text-muted-foreground">{revenue.description ?? "—"}</td>
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
            <h3 className="font-bold mb-3">المصروفات</h3>
            <div className="bg-card border rounded-xl overflow-hidden">
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
            <h3 className="font-bold mb-3">معاملات KNET</h3>
            <div className="bg-card border rounded-xl overflow-hidden">
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
                      <td className="number text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString("ar-KW")}
                      </td>
                      <td className="number text-sm">{transaction.transactionRef ?? "—"}</td>
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
            <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
            <p className="text-sm">{operation.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
