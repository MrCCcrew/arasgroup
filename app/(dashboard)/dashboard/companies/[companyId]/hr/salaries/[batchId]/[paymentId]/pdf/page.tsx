import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLocale } from "@/lib/i18n";
import { formatKWD } from "@/lib/utils";

interface Props {
  params: Promise<{ companyId: string; batchId: string; paymentId: string }>;
  searchParams: Promise<{ locale?: string }>;
}

const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function SalaryPDFPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { companyId, paymentId } = await params;
  const sp = await searchParams;
  const defaultLocale = await getLocale();
  const locale = (sp.locale as "ar" | "en") || defaultLocale;
  const numberLocale = locale === "en" ? "en-US" : "ar-KW";

  const payment = await prisma.salaryPayment.findUnique({
    where: { id: paymentId },
    include: {
      employee: {
        select: { nameAr: true, nameEn: true, employeeNumber: true },
      },
      batch: {
        select: { month: true, year: true, companyId: true },
      },
    },
  });

  if (!payment || payment.batch.companyId !== companyId) {
    return <div className="p-8 text-center">غير متاح</div>;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { nameAr: true, nameEn: true },
  });

  const items = await prisma.salaryItem.findMany({
    where: { salaryPaymentId: paymentId },
    orderBy: { createdAt: "asc" },
  });

  const earnings = items.filter((it) => it.category === "EARNING");
  const deductions = items.filter((it) => it.category === "DEDUCTION");

  const month = locale === "en" ? MONTHS_EN[payment.batch.month - 1] : MONTHS_AR[payment.batch.month - 1];
  const empName = locale === "en" ? payment.employee.nameEn || payment.employee.nameAr : payment.employee.nameAr;
  const compName = locale === "en" ? company?.nameEn || company?.nameAr : company?.nameAr;

  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
      <head>
        <meta charSet="utf-8" />
        <title>{locale === "en" ? "Salary Slip" : "قسيمة راتب"}</title>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { margin: 1cm; size: A4; }
            body { margin: 0; }
            .no-print { display: none !important; }
          }
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            color: #000;
          }
          .print-btn {
            position: fixed;
            top: 20px;
            ${locale === "en" ? "right: 20px;" : "left: 20px;"}
            background: #1e40af;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
          }
          .print-btn:hover { background: #1e3a8a; }
          .header {
            text-align: center;
            border-bottom: 3px solid #1e40af;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .company { font-size: 24px; font-weight: bold; color: #1e40af; }
          .title { font-size: 20px; font-weight: 600; margin-top: 10px; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f3f4f6; padding: 20px; border-radius: 8px; }
          .info div { display: flex; justify-content: space-between; padding: 8px 0; }
          .label { font-weight: 600; color: #6b7280; }
          .value { font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f9fafb; padding: 12px; text-align: ${locale === "en" ? "left" : "right"}; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
          td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
          .amount { font-family: monospace; font-weight: 500; text-align: ${locale === "en" ? "right" : "left"}; }
          .section { font-size: 16px; font-weight: 600; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; }
          .total { background: #1e40af; color: white; font-weight: bold; font-size: 18px; }
          .total td { padding: 15px; border: none; }
          .footer { margin-top: 40px; text-align: center; color: #6b7280; font-size: 12px; }
        ` }} />
      </head>
      <body>
        <button className="print-btn no-print" onClick="window.print()">
          {locale === "en" ? "🖨️ Print PDF" : "🖨️ طباعة PDF"}
        </button>
        
        <div className="header">
          <div className="company">{compName}</div>
          <div className="title">{locale === "en" ? "Salary Slip" : "قسيمة راتب"}</div>
        </div>

        <div className="info">
          <div><span className="label">{locale === "en" ? "Employee:" : "الموظف:"}</span><span className="value">{empName}</span></div>
          <div><span className="label">{locale === "en" ? "Employee No:" : "رقم الموظف:"}</span><span className="value">{payment.employee.employeeNumber || "—"}</span></div>
          <div><span className="label">{locale === "en" ? "Period:" : "الفترة:"}</span><span className="value">{month} {payment.batch.year}</span></div>
          <div><span className="label">{locale === "en" ? "Date:" : "التاريخ:"}</span><span className="value">{new Date().toLocaleDateString(numberLocale)}</span></div>
        </div>

        <div className="section">{locale === "en" ? "Earnings" : "الاستحقاقات"}</div>
        <table>
          <thead>
            <tr>
              <th>{locale === "en" ? "Description" : "البيان"}</th>
              <th>{locale === "en" ? "Amount (KWD)" : "المبلغ (د.ك)"}</th>
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
            <div className="section">{locale === "en" ? "Deductions" : "الخصومات"}</div>
            <table>
              <thead>
                <tr>
                  <th>{locale === "en" ? "Description" : "البيان"}</th>
                  <th>{locale === "en" ? "Amount (KWD)" : "المبلغ (د.ك)"}</th>
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
            <tr className="total">
              <td>{locale === "en" ? "Net Salary" : "صافي الراتب"}</td>
              <td className="amount">{formatKWD(Number(payment.netAmount), numberLocale)}</td>
            </tr>
          </tbody>
        </table>

        <div className="footer">
          {locale === "en" ? "Computer-generated document. No signature required." : "وثيقة إلكترونية. لا حاجة للتوقيع."}
        </div>
      </body>
    </html>
  );
}
