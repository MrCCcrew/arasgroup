import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { buildSalaryWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { uploadToR2 } from "@/lib/storage/r2";
import { renderSalarySlipPdfBuffer } from "@/lib/hr/salary-slip-pdf";

const AR = {
  paymentIdRequired: "\u0645\u0639\u0631\u0641 \u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0627\u062a\u0628 \u0645\u0637\u0644\u0648\u0628",
  paymentNotFound: "\u062f\u0641\u0639\u0629 \u0627\u0644\u0631\u0627\u062a\u0628 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629",
} as const;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams, origin } = new URL(request.url);
  const paymentId = searchParams.get("paymentId");
  const locale = searchParams.get("locale") === "en" ? "en" : "ar";

  if (!paymentId) {
    return NextResponse.json({ success: false, error: AR.paymentIdRequired }, { status: 400 });
  }

  const payment = await prisma.salaryPayment.findUnique({
    where: { id: paymentId },
    include: {
      employee: {
        select: { nameAr: true, nameEn: true, phone: true, employeeNumber: true },
      },
      batch: {
        select: { id: true, month: true, year: true, companyId: true },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ success: false, error: AR.paymentNotFound }, { status: 404 });
  }

  const [company, items] = await Promise.all([
    prisma.company.findUnique({
      where: { id: payment.batch.companyId },
      select: { nameAr: true, nameEn: true },
    }),
    prisma.salaryItem.findMany({
      where: { salaryPaymentId: payment.id },
      select: { titleAr: true, titleEn: true, amount: true, category: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  let pdfUrl =
    `${origin}/dashboard/companies/${payment.batch.companyId}` +
    `/hr/salaries/${payment.batch.id}/${payment.id}/pdf?locale=${locale}`;

  const hasR2Config = Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL,
  );

  if (hasR2Config) {
    const pdfBuffer = await renderSalarySlipPdfBuffer({
      locale,
      companyName:
        locale === "en"
          ? company?.nameEn ?? company?.nameAr ?? "-"
          : company?.nameAr ?? company?.nameEn ?? "-",
      employeeName:
        locale === "en"
          ? payment.employee.nameEn ?? payment.employee.nameAr
          : payment.employee.nameAr,
      employeeNumber: payment.employee.employeeNumber,
      month: payment.batch.month,
      year: payment.batch.year,
      earnings: items
        .filter((item) => item.category === "EARNING")
        .map((item) => ({
          titleAr: item.titleAr,
          titleEn: item.titleEn,
          amount: Number(item.amount),
        })),
      deductions: items
        .filter((item) => item.category === "DEDUCTION")
        .map((item) => ({
          titleAr: item.titleAr,
          titleEn: item.titleEn,
          amount: Number(item.amount),
        })),
      netAmount: Number(payment.netAmount),
    });

    const key = `salary-slips/${payment.batch.companyId}/${payment.batch.id}/${payment.id}-${locale}.pdf`;
    pdfUrl = await uploadToR2(key, pdfBuffer, "application/pdf");
  }

  const message = buildSalaryWhatsAppMessage({
    locale,
    employeeName: locale === "en" ? payment.employee.nameEn ?? payment.employee.nameAr : payment.employee.nameAr,
    month: payment.batch.month,
    year: payment.batch.year,
    baseAmount: Number(payment.baseAmount),
    incentives: Number(payment.incentives) + Number(payment.additionalEarnings ?? 0),
    deductions: Number(payment.deductions),
    netAmount: Number(payment.netAmount),
    pdfUrl,
  });

  return NextResponse.json({
    success: true,
    data: {
      phone: payment.employee.phone,
      message,
      pdfUrl,
      url: payment.employee.phone ? buildWhatsAppUrl(payment.employee.phone, message) : null,
    },
  });
}
