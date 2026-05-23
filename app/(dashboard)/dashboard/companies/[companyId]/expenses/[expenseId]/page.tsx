import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; expenseId: string }>;
}

const PAYMENT_METHOD_LABELS = {
  ar: {
    CASH: "نقدي",
    BANK_TRANSFER: "تحويل بنكي",
    BANK: "تحويل بنكي",
    CHECK: "شيك",
    CHEQUE: "شيك",
    KNET: "KNET",
    CARD: "بطاقة",
    CREDIT_CARD: "بطاقة ائتمان",
  },
  en: {
    CASH: "Cash",
    BANK_TRANSFER: "Bank transfer",
    BANK: "Bank transfer",
    CHECK: "Cheque",
    CHEQUE: "Cheque",
    KNET: "KNET",
    CARD: "Card",
    CREDIT_CARD: "Credit Card",
  },
} as const;

export default async function ExpenseDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, expenseId } = await params;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, companyId, isDeleted: false },
  });

  if (!expense) notFound();

  const [category, bankAccount, branch, employee, driver] = await Promise.all([
    prisma.expenseCategory.findUnique({
      where: { id: expense.categoryId },
      select: { nameAr: true, nameEn: true, type: true },
    }),
    expense.bankAccountId
      ? prisma.bankAccount.findUnique({
          where: { id: expense.bankAccountId },
          select: { nameAr: true, nameEn: true, bankName: true },
        })
      : Promise.resolve(null),
    expense.branchId
      ? prisma.branch.findUnique({
          where: { id: expense.branchId },
          select: { nameAr: true, nameEn: true },
        })
      : Promise.resolve(null),
    expense.employeeId
      ? prisma.employee.findUnique({
          where: { id: expense.employeeId },
          select: { nameAr: true, nameEn: true },
        })
      : Promise.resolve(null),
    expense.driverId
      ? prisma.driver.findUnique({
          where: { id: expense.driverId },
          include: { employee: { select: { nameAr: true, nameEn: true } } },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <Header
        title={locale === "en" ? "Expense Details" : "تفاصيل المصروف"}
        subtitle={category ? (locale === "en" ? category.nameEn ?? category.nameAr : category.nameAr) : locale === "en" ? "Expense" : "مصروف"}
        companyId={companyId}
      />

      <div className="page-container max-w-3xl space-y-6">
        <Link href={`/dashboard/companies/${companyId}/expenses`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowRight size={14} />
          {locale === "en" ? "Back to expenses" : "العودة للمصروفات"}
        </Link>

        <div className="section-card space-y-5">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Total amount" : "إجمالي المبلغ"}</p>
              <p className="number text-3xl font-bold text-red-600">{formatKWD(Number(expense.amount), numberLocale)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm ${expense.isRecurring ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}`}>
              {expense.isRecurring ? (locale === "en" ? "Recurring" : "متكرر") : locale === "en" ? "One-time" : "لمرة واحدة"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Date" : "التاريخ"}</p>
              <p className="font-medium">{formatDate(expense.date, numberLocale)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Category" : "التصنيف"}</p>
              <p className="font-medium">{category ? (locale === "en" ? category.nameEn ?? category.nameAr : category.nameAr) : "-"}</p>
            </div>
            <div className="col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Description" : "البيان"}</p>
              <p className="font-medium">{expense.descriptionAr}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Payment method" : "طريقة الدفع"}</p>
              <p className="font-medium">{PAYMENT_METHOD_LABELS[locale][expense.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS.ar] ?? expense.paymentMethod}</p>
            </div>
            {bankAccount && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Bank account" : "الحساب البنكي"}</p>
                <p className="font-medium">{locale === "en" ? bankAccount.nameEn ?? bankAccount.nameAr : bankAccount.nameAr}</p>
                <p className="text-xs text-muted-foreground">{bankAccount.bankName}</p>
              </div>
            )}
            {expense.reference && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Reference no." : "رقم المرجع"}</p>
                <p className="font-mono text-sm">{expense.reference}</p>
              </div>
            )}
            {branch && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Branch" : "الفرع"}</p>
                <p className="font-medium">{locale === "en" ? branch.nameEn ?? branch.nameAr : branch.nameAr}</p>
              </div>
            )}
            {employee && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Employee" : "الموظف"}</p>
                <p className="font-medium">{locale === "en" ? employee.nameEn ?? employee.nameAr : employee.nameAr}</p>
              </div>
            )}
            {driver && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">{locale === "en" ? "Driver" : "السائق"}</p>
                <p className="font-medium">{locale === "en" ? driver.employee.nameEn ?? driver.employee.nameAr : driver.employee.nameAr}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
