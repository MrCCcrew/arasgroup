import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { ExpenseRowActions } from "@/components/expenses/expense-row-actions";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ categoryId?: string; page?: string; startDate?: string; endDate?: string }>;
}

function getJournalStatusLabel(status: string | null | undefined, locale: "ar" | "en") {
  if (status === "POSTED") return locale === "en" ? "Posted" : "مرحل";
  if (status === "APPROVED") return locale === "en" ? "Approved" : "معتمد";
  if (status === "PENDING_APPROVAL") return locale === "en" ? "Pending approval" : "بانتظار الموافقة";
  return locale === "en" ? "Draft" : "مسودة";
}

function getJournalStatusClass(status: string | null | undefined) {
  if (status === "POSTED") return "bg-green-100 text-green-700";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "PENDING_APPROVAL") return "bg-yellow-100 text-yellow-700";
  return "bg-slate-100 text-slate-700";
}

export default async function ExpensesPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const page = Number.parseInt(sp.page ?? "1", 10);
  const pageSize = 25;

  const now = new Date();
  const startDate = sp.startDate ? new Date(`${sp.startDate}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = sp.endDate ? new Date(`${sp.endDate}T23:59:59.999`) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const where = {
    companyId,
    isDeleted: false,
    date: { gte: startDate, lte: endDate },
    ...(sp.categoryId ? { categoryId: sp.categoryId } : {}),
  };

  const [total, expenses, categories, bankAccounts, expensesTotal] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: {
        category: { select: { nameAr: true, nameEn: true, type: true } },
      },
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.expenseCategory.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, bankName: true },
      orderBy: { nameAr: "asc" },
    }),
    prisma.expense.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  type ExpenseRow = typeof expenses[number];
  const journalEntryIds = expenses.map((expense: ExpenseRow) => expense.journalEntryId).filter((value: ExpenseRow["journalEntryId"]): value is string => Boolean(value));
  const linkedJournalEntries = journalEntryIds.length
    ? await prisma.journalEntry.findMany({
        where: { id: { in: journalEntryIds } },
        select: { id: true, status: true },
      })
    : [];
  const journalStatusById = new Map<string, typeof linkedJournalEntries[number]["status"]>(linkedJournalEntries.map((entry: typeof linkedJournalEntries[number]) => [entry.id, entry.status]));

  const totalAmount = Number(expensesTotal._sum.amount ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <Header
        title={locale === "en" ? "Expenses" : "المصروفات"}
        subtitle={`${formatDate(startDate, numberLocale)} - ${formatDate(endDate, numberLocale)}`}
        companyId={companyId}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/companies/${companyId}/expenses/categories`}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Settings2 size={16} />
              {locale === "en" ? "Categories" : "الفئات"}
            </Link>
            <Link
              href={`/dashboard/companies/${companyId}/expenses/new`}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              {locale === "en" ? "New expense" : "مصروف جديد"}
            </Link>
          </div>
        }
      />

      <div className="page-container space-y-4">
        <form method="get" className="section-card">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "From" : "من"}</label>
              <input
                type="date"
                name="startDate"
                defaultValue={sp.startDate ?? startDate.toISOString().slice(0, 10)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "To" : "إلى"}</label>
              <input
                type="date"
                name="endDate"
                defaultValue={sp.endDate ?? endDate.toISOString().slice(0, 10)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Category" : "الفئة"}</label>
              <select name="categoryId" defaultValue={sp.categoryId ?? ""} className="input-field">
                <option value="">{locale === "en" ? "All categories" : "كل الفئات"}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.nameAr}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              {locale === "en" ? "Filter" : "تصفية"}
            </button>
            {(sp.categoryId || sp.startDate || sp.endDate) && (
              <a
                href={`/dashboard/companies/${companyId}/expenses`}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {locale === "en" ? "Clear" : "مسح"}
              </a>
            )}
          </div>
        </form>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Total expenses" : "إجمالي المصروفات"}</p>
            <p className="number text-2xl font-bold text-red-600">{formatKWD(totalAmount, numberLocale)}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Transactions count" : "عدد المعاملات"}</p>
            <p className="text-2xl font-bold">{total}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-muted-foreground">{locale === "en" ? "Average expense" : "متوسط المصروف"}</p>
            <p className="number text-2xl font-bold">{formatKWD(total > 0 ? totalAmount / total : 0, numberLocale)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Date" : "التاريخ"}</th>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Category" : "الفئة"}</th>
                  <th>{locale === "en" ? "Amount" : "المبلغ"}</th>
                  <th>{locale === "en" ? "Payment method" : "طريقة الدفع"}</th>
                  <th>{locale === "en" ? "Journal status" : "حالة القيد"}</th>
                  <th>{locale === "en" ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {locale === "en" ? "No expenses found in this period" : "لا توجد مصروفات في هذه الفترة"}
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense: ExpenseRow) => (
                    <tr key={expense.id} className="transition-colors hover:bg-muted/20">
                      <td className="text-sm">{formatDate(expense.date, numberLocale)}</td>
                      <td className="max-w-48 truncate text-sm">{expense.descriptionAr}</td>
                      <td>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {locale === "en" ? expense.category.nameEn ?? expense.category.nameAr : expense.category.nameAr}
                        </span>
                      </td>
                      <td className="number font-bold text-red-600">{formatKWD(Number(expense.amount), numberLocale)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            expense.paymentMethod === "CASH" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {expense.paymentMethod === "CASH"
                            ? locale === "en"
                              ? "Cash"
                              : "نقدي"
                            : expense.paymentMethod === "BANK"
                            ? locale === "en"
                              ? "Bank"
                              : "بنك"
                            : expense.paymentMethod}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${getJournalStatusClass(
                            expense.journalEntryId ? journalStatusById.get(expense.journalEntryId) : null,
                          )}`}
                        >
                          {getJournalStatusLabel(expense.journalEntryId ? journalStatusById.get(expense.journalEntryId) : null, locale)}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Link href={`/dashboard/companies/${companyId}/expenses/${expense.id}`} className="rounded p-1.5 text-xs text-primary hover:underline">
                            {locale === "en" ? "View" : "عرض"}
                          </Link>
                          <ExpenseRowActions
                            expenseId={expense.id}
                            date={expense.date.toISOString()}
                            amount={expense.amount.toString()}
                            descriptionAr={expense.descriptionAr}
                            categoryId={expense.categoryId}
                            paymentMethod={expense.paymentMethod}
                            bankAccountId={expense.bankAccountId}
                            reference={expense.reference}
                            categories={categories}
                            bankAccounts={bankAccounts}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {expenses.length > 0 && (
                <tfoot className="border-t-2 bg-muted/20 font-bold">
                  <tr>
                    <td colSpan={3} className="text-center">{locale === "en" ? "Total" : "الإجمالي"}</td>
                    <td className="number text-red-600">{formatKWD(totalAmount, numberLocale)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_: unknown, index: number) => index + 1).map((currentPage: number) => (
              <Link
                key={currentPage}
                href={`/dashboard/companies/${companyId}/expenses?page=${currentPage}`}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
                  currentPage === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {currentPage}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
