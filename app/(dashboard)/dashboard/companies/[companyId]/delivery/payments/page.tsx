import Link from "next/link";
import { redirect } from "next/navigation";
import { DollarSign, Plus, TrendingUp, Wallet } from "lucide-react";
import { Header } from "@/components/layout/header";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatDate, formatKWD } from "@/lib/utils";
import { PaymentRowActions } from "@/components/delivery/payment-row-actions";

interface Props {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<{ platform?: string; year?: string; month?: string }>;
}

const KNOWN_PLATFORMS: Record<string, { ar: string; en: string; color: string }> = {
  TALABAT: { ar: "طلبات", en: "Talabat", color: "bg-orange-100 text-orange-700" },
  RO_POPS: { ar: "رو بوبس", en: "Ro Pops", color: "bg-blue-100 text-blue-700" },
};

function getPlatformLabel(platform: string | null, locale: string): string {
  if (!platform) return locale === "en" ? "No platform" : "بدون منصة";
  return KNOWN_PLATFORMS[platform]?.[locale as "ar" | "en"] ?? platform;
}

function getPlatformColor(platform: string | null): string {
  if (!platform) return "bg-gray-100 text-gray-500";
  return KNOWN_PLATFORMS[platform]?.color ?? "bg-purple-100 text-purple-700";
}

const MONTHS = {
  ar: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

export default async function DeliveryPaymentsPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId } = await params;
  const sp = await searchParams;
  const locale = await getLocale();
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const now = new Date();
  const year = sp.year ? Number.parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? Number.parseInt(sp.month, 10) : now.getMonth() + 1;

  const where = {
    companyId,
    receivedDate: {
      gte: new Date(year, month ? month - 1 : 0, 1),
      lte: new Date(year, month ? month : 12, 0, 23, 59, 59),
    },
    ...(sp.platform ? { platform: sp.platform } : {}),
  };

  const [payments, bankAccounts] = await Promise.all([
    prisma.companyPayment.findMany({
      where,
      include: {
        contract: { select: { nameAr: true, nameEn: true, platform: true } },
        bankAccount: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { receivedDate: "desc" },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true, bankName: true },
      orderBy: { nameAr: "asc" },
    }),
  ]);

  type DeliveryPaymentRow = typeof payments[number];
  const totalGross = payments.reduce((sum: number, payment: DeliveryPaymentRow) => sum + Number(payment.grossAmount), 0);
  const totalWallet = payments.reduce((sum: number, payment: DeliveryPaymentRow) => sum + Number(payment.walletDeductions), 0);
  const totalNet = payments.reduce((sum: number, payment: DeliveryPaymentRow) => sum + Number(payment.netReceived), 0);

  return (
    <div>
      <Header
        title={locale === "en" ? "Company Payments" : "مدفوعات الشركة"}
        subtitle={locale === "en" ? "Delivery revenue received from platforms" : "إيرادات التوصيل الواردة من المنصات"}
        companyId={companyId}
        actions={
          <Link
            href={`/dashboard/companies/${companyId}/delivery/payments/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={16} />
            {locale === "en" ? "Record payment" : "تسجيل دفعة"}
          </Link>
        }
      />

      <div className="page-container space-y-4">
        <form method="get" className="section-card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Year" : "السنة"}</label>
              <select name="year" defaultValue={year} className="input-field">
                {[2024, 2025, 2026].map((value: number) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Month" : "الشهر"}</label>
              <select name="month" defaultValue={month} className="input-field">
                <option value="">{locale === "en" ? "All months" : "كل الشهور"}</option>
                {MONTHS[locale].map((monthName: string, index: number) => (
                  <option key={index + 1} value={index + 1}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{locale === "en" ? "Platform" : "المنصة"}</label>
              <select name="platform" defaultValue={sp.platform ?? ""} className="input-field">
                <option value="">{locale === "en" ? "All platforms" : "كل المنصات"}</option>
                {Object.entries(KNOWN_PLATFORMS).map(([key, val]: [string, { ar: string; en: string; color: string }]) => (
                  <option key={key} value={key}>{locale === "en" ? val.en : val.ar}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {locale === "en" ? "Filter" : "بحث"}
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp size={16} />
              <span className="text-sm">{locale === "en" ? "Gross invoices" : "إجمالي الفواتير"}</span>
            </div>
            <span className="number text-2xl font-bold">{formatKWD(totalGross, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet size={16} />
              <span className="text-sm">{locale === "en" ? "Wallet deductions" : "خصومات المحفظة"}</span>
            </div>
            <span className="number text-2xl font-bold text-orange-600">{formatKWD(totalWallet, numberLocale)}</span>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign size={16} />
              <span className="text-sm">{locale === "en" ? "Net received" : "صافي المستلم"}</span>
            </div>
            <span className="number text-2xl font-bold text-green-600">{formatKWD(totalNet, numberLocale)}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="ar-table">
              <thead>
                <tr>
                  <th>{locale === "en" ? "Received date" : "تاريخ الاستلام"}</th>
                  <th>{locale === "en" ? "Platform" : "المنصة"}</th>
                  <th>{locale === "en" ? "Contract" : "العقد"}</th>
                  <th>{locale === "en" ? "Month" : "الشهر"}</th>
                  <th>{locale === "en" ? "Bank account" : "الحساب البنكي"}</th>
                  <th>{locale === "en" ? "Gross amount" : "إجمالي الفاتورة"}</th>
                  <th>{locale === "en" ? "Wallet deduction" : "خصم المحفظة"}</th>
                  <th>{locale === "en" ? "Net received" : "صافي المستلم"}</th>
                  <th>{locale === "en" ? "Status" : "الحالة"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      {locale === "en" ? "No payments found in this period" : "لا توجد مدفوعات في هذه الفترة"}
                    </td>
                  </tr>
                ) : (
                  payments.map((payment: DeliveryPaymentRow) => (
                    <tr key={payment.id} className="hover:bg-muted/10">
                      <td className="text-sm">{formatDate(payment.receivedDate, numberLocale)}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getPlatformColor(payment.platform)}`}>
                          {getPlatformLabel(payment.platform, locale)}
                        </span>
                      </td>
                      <td className="text-sm">
                        {payment.contract ? (locale === "en" ? payment.contract.nameEn ?? payment.contract.nameAr : payment.contract.nameAr) : "-"}
                      </td>
                      <td className="text-sm">
                        {MONTHS[locale][payment.month - 1]} {payment.year}
                      </td>
                      <td className="text-sm text-muted-foreground">
                        {payment.bankAccount ? (locale === "en" ? payment.bankAccount.nameEn ?? payment.bankAccount.nameAr : payment.bankAccount.nameAr) : "-"}
                      </td>
                      <td className="number font-medium">{formatKWD(Number(payment.grossAmount), numberLocale)}</td>
                      <td className="number text-orange-600">{formatKWD(Number(payment.walletDeductions), numberLocale)}</td>
                      <td className="number font-bold text-green-600">{formatKWD(Number(payment.netReceived), numberLocale)}</td>
                      <td>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            payment.status === "RECEIVED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {payment.status === "RECEIVED" ? (locale === "en" ? "Received" : "مستلم") : payment.status}
                        </span>
                      </td>
                      <td>
                        <PaymentRowActions
                          paymentId={payment.id}
                          platform={payment.platform}
                          month={payment.month}
                          year={payment.year}
                          grossAmount={payment.grossAmount.toString()}
                          walletDeductions={payment.walletDeductions.toString()}
                          netReceived={payment.netReceived.toString()}
                          receivedDate={payment.receivedDate.toISOString()}
                          bankAccountId={payment.bankAccountId}
                          notes={payment.notes}
                          bankAccounts={bankAccounts}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {payments.length > 0 && (
                <tfoot className="border-t-2 bg-muted/30 font-bold">
                  <tr>
                    <td colSpan={5} className="py-2 text-center">
                      {locale === "en" ? "Total" : "الإجمالي"}
                    </td>
                    <td className="number">{formatKWD(totalGross, numberLocale)}</td>
                    <td className="number text-orange-600">{formatKWD(totalWallet, numberLocale)}</td>
                    <td className="number text-green-600">{formatKWD(totalNet, numberLocale)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
