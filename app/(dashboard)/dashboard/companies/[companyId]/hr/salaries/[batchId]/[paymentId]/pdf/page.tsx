import { redirect } from "next/navigation";
import { PrintControls } from "@/components/ui/print-controls";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; batchId: string; paymentId: string }>;
  searchParams: Promise<{ locale?: string }>;
}

const AR = {
  unavailable: "\u063a\u064a\u0631 \u0645\u062a\u0627\u062d",
  salarySlip: "\u0642\u0633\u064a\u0645\u0629 \u0631\u0627\u062a\u0628",
  employee: "\u0627\u0644\u0645\u0648\u0638\u0641",
  employeeNo: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641",
  period: "\u0627\u0644\u0641\u062a\u0631\u0629",
  date: "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  earnings: "\u0627\u0644\u0627\u0633\u062a\u062d\u0642\u0627\u0642\u0627\u062a",
  deductions: "\u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a",
  description: "\u0627\u0644\u0628\u064a\u0627\u0646",
  amount: "\u0627\u0644\u0645\u0628\u0644\u063a (\u062f.\u0643)",
  netSalary: "\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0627\u062a\u0628",
  generated: "\u0648\u062b\u064a\u0642\u0629 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629. \u0644\u0627 \u062d\u0627\u062c\u0629 \u0644\u0644\u062a\u0648\u0642\u064a\u0639.",
  baseSalary: "\u0627\u0644\u0631\u0627\u062a\u0628 \u0627\u0644\u0623\u0633\u0627\u0633\u064a",
  incentivesAndAdditions: "\u0627\u0644\u062d\u0648\u0627\u0641\u0632 \u0648\u0627\u0644\u0625\u0636\u0627\u0641\u0627\u062a",
  totalDeductions: "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u062e\u0635\u0648\u0645\u0627\u062a",
  additionalDetails: "\u062a\u0641\u0627\u0635\u064a\u0644 \u0625\u0636\u0627\u0641\u064a\u0629",
  attendanceDays: "\u0623\u064a\u0627\u0645 \u0627\u0644\u062d\u0636\u0648\u0631",
  evaluation: "\u0627\u0644\u062a\u0642\u064a\u064a\u0645",
  targetOrders: "\u0627\u0644\u062a\u0627\u0631\u062c\u062a",
  actualOrders: "\u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u0641\u0639\u0644\u064a\u0629",
  walletAmount: "\u0627\u0644\u0645\u062d\u0641\u0638\u0629",
  deliveredAmount: "\u0627\u0644\u0645\u0628\u0644\u063a \u0627\u0644\u0645\u0633\u0644\u0645",
  notes: "\u0645\u0644\u0627\u062d\u0638\u0627\u062a",
} as const;

const MONTHS_AR = [
  "\u064a\u0646\u0627\u064a\u0631",
  "\u0641\u0628\u0631\u0627\u064a\u0631",
  "\u0645\u0627\u0631\u0633",
  "\u0623\u0628\u0631\u064a\u0644",
  "\u0645\u0627\u064a\u0648",
  "\u064a\u0648\u0646\u064a\u0648",
  "\u064a\u0648\u0644\u064a\u0648",
  "\u0623\u063a\u0633\u0637\u0633",
  "\u0633\u0628\u062a\u0645\u0628\u0631",
  "\u0623\u0643\u062a\u0648\u0628\u0631",
  "\u0646\u0648\u0641\u0645\u0628\u0631",
  "\u062f\u064a\u0633\u0645\u0628\u0631",
];
const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default async function SalaryPDFPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, batchId, paymentId } = await params;
  const sp = await searchParams;
  const defaultLocale = await getLocale();
  const locale = sp.locale === "en" ? "en" : sp.locale === "ar" ? "ar" : defaultLocale;
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const payment = await prisma.salaryPayment.findUnique({
    where: { id: paymentId },
    include: {
      employee: {
        select: { nameAr: true, nameEn: true, employeeNumber: true },
      },
      batch: {
        select: { id: true, month: true, year: true, companyId: true },
      },
    },
  });

  if (!payment || payment.batch.companyId !== companyId || payment.batch.id !== batchId) {
    return <div className="p-8 text-center">{locale === "en" ? "Unavailable" : AR.unavailable}</div>;
  }

  const [company, items] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { nameAr: true, nameEn: true },
    }),
    prisma.salaryItem.findMany({
      where: { salaryPaymentId: paymentId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const earnings = items.filter((item) => item.category === "EARNING");
  const deductions = items.filter((item) => item.category === "DEDUCTION");
  const month = locale === "en" ? MONTHS_EN[payment.batch.month - 1] : MONTHS_AR[payment.batch.month - 1];
  const employeeName = locale === "en" ? payment.employee.nameEn || payment.employee.nameAr : payment.employee.nameAr;
  const companyName = locale === "en" ? company?.nameEn || company?.nameAr : company?.nameAr;
  const backHref = `/dashboard/companies/${companyId}/hr/salaries/${batchId}`;
  const details = [
    payment.attendanceDays != null
      ? { label: locale === "en" ? "Attendance days:" : `${AR.attendanceDays}:`, value: Number(payment.attendanceDays).toFixed(1) }
      : null,
    payment.evaluationScore != null
      ? { label: locale === "en" ? "Evaluation:" : `${AR.evaluation}:`, value: Number(payment.evaluationScore).toFixed(1) }
      : null,
    payment.targetOrders != null
      ? { label: locale === "en" ? "Target orders:" : `${AR.targetOrders}:`, value: String(payment.targetOrders) }
      : null,
    payment.actualOrders != null
      ? { label: locale === "en" ? "Actual orders:" : `${AR.actualOrders}:`, value: String(payment.actualOrders) }
      : null,
    payment.walletAmount != null
      ? { label: locale === "en" ? "Wallet amount:" : `${AR.walletAmount}:`, value: formatKWD(Number(payment.walletAmount), numberLocale) }
      : null,
    payment.amountDeliveredByDriver != null
      ? {
          label: locale === "en" ? "Delivered amount:" : `${AR.deliveredAmount}:`,
          value: formatKWD(Number(payment.amountDeliveredByDriver), numberLocale),
        }
      : null,
    payment.notes ? { label: locale === "en" ? "Notes:" : `${AR.notes}:`, value: payment.notes } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f5f6f8;
          color: #111827;
          direction: ${locale === "en" ? "ltr" : "rtl"};
        }
        .page {
          max-width: 210mm;
          margin: 2rem auto;
          background: white;
          border: 1px solid #e5e7eb;
          padding: 2rem;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #1d4ed8;
          padding-bottom: 1rem;
          margin-bottom: 1.5rem;
        }
        .company {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1d4ed8;
        }
        .title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 0.5rem;
        }
        .info {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
          margin-bottom: 1.5rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 1rem;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.35rem 0;
        }
        .label {
          color: #6b7280;
          font-weight: 600;
        }
        .value {
          font-weight: 500;
        }
        .section {
          font-size: 1rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          padding-bottom: 0.35rem;
          border-bottom: 2px solid #e5e7eb;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 0.75rem 0 1rem;
        }
        th {
          background: #f3f4f6;
          text-align: ${locale === "en" ? "left" : "right"};
          padding: 0.75rem;
          border: 1px solid #e5e7eb;
          font-weight: 700;
        }
        td {
          padding: 0.7rem 0.75rem;
          border: 1px solid #e5e7eb;
        }
        .amount {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          text-align: ${locale === "en" ? "right" : "left"};
          white-space: nowrap;
        }
        .total-row td {
          background: #1d4ed8;
          color: white;
          font-weight: 700;
          font-size: 1rem;
        }
        .footer {
          margin-top: 2rem;
          text-align: center;
          color: #6b7280;
          font-size: 0.8rem;
        }
        @media print {
          body { background: white; }
          .page {
            max-width: 100%;
            margin: 0;
            padding: 0;
            border: none;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>

      <PrintControls backHref={backHref} />

      <div className="page">
        <div className="header">
          <div className="company">{companyName}</div>
          <div className="title">{locale === "en" ? "Salary Slip" : AR.salarySlip}</div>
        </div>

        <div className="info">
          <div className="info-row">
            <span className="label">{locale === "en" ? "Employee:" : `${AR.employee}:`}</span>
            <span className="value">{employeeName}</span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Employee No:" : `${AR.employeeNo}:`}</span>
            <span className="value">{payment.employee.employeeNumber || "-"}</span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Period:" : `${AR.period}:`}</span>
            <span className="value">{month} {payment.batch.year}</span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Date:" : `${AR.date}:`}</span>
            <span className="value">{new Date().toLocaleDateString(numberLocale)}</span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Base salary:" : `${AR.baseSalary}:`}</span>
            <span className="value">{formatKWD(Number(payment.baseAmount), numberLocale)}</span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Incentives & additions:" : `${AR.incentivesAndAdditions}:`}</span>
            <span className="value">
              {formatKWD(Number(payment.incentives) + Number(payment.additionalEarnings ?? 0), numberLocale)}
            </span>
          </div>
          <div className="info-row">
            <span className="label">{locale === "en" ? "Total deductions:" : `${AR.totalDeductions}:`}</span>
            <span className="value">{formatKWD(Number(payment.deductions), numberLocale)}</span>
          </div>
        </div>

        {details.length > 0 && (
          <>
            <div className="section">{locale === "en" ? "Additional details" : AR.additionalDetails}</div>
            <div className="info">
              {details.map((detail) => (
                <div key={detail.label} className="info-row">
                  <span className="label">{detail.label}</span>
                  <span className="value">{detail.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="section">{locale === "en" ? "Earnings" : AR.earnings}</div>
        <table>
          <thead>
            <tr>
              <th>{locale === "en" ? "Description" : AR.description}</th>
              <th>{locale === "en" ? "Amount (KWD)" : AR.amount}</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((item) => (
              <tr key={item.id}>
                <td>{locale === "en" ? item.titleEn : item.titleAr}</td>
                <td className="amount">{formatKWD(Number(item.amount), numberLocale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {deductions.length > 0 && (
          <>
            <div className="section">{locale === "en" ? "Deductions" : AR.deductions}</div>
            <table>
              <thead>
                <tr>
                  <th>{locale === "en" ? "Description" : AR.description}</th>
                  <th>{locale === "en" ? "Amount (KWD)" : AR.amount}</th>
                </tr>
              </thead>
              <tbody>
                {deductions.map((item) => (
                  <tr key={item.id}>
                    <td>{locale === "en" ? item.titleEn : item.titleAr}</td>
                    <td className="amount">{formatKWD(Number(item.amount), numberLocale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <table>
          <tbody>
            <tr className="total-row">
              <td>{locale === "en" ? "Net Salary" : AR.netSalary}</td>
              <td className="amount">{formatKWD(Number(payment.netAmount), numberLocale)}</td>
            </tr>
          </tbody>
        </table>

        <div className="footer">
          {locale === "en" ? "Computer-generated document. No signature required." : AR.generated}
        </div>
      </div>
    </>
  );
}
