import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { buildSalaryWhatsAppMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("paymentId");
  const locale = searchParams.get("locale") === "en" ? "en" : "ar";

  if (!paymentId) {
    return NextResponse.json({ success: false, error: "معرف دفعة الراتب مطلوب" }, { status: 400 });
  }

  const payment = await prisma.salaryPayment.findUnique({
    where: { id: paymentId },
    include: {
      employee: { select: { nameAr: true, nameEn: true, phone: true } },
      batch: { select: { month: true, year: true, companyId: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ success: false, error: "دفعة الراتب غير موجودة" }, { status: 404 });
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
  });

  return NextResponse.json({
    success: true,
    data: {
      phone: payment.employee.phone,
      message,
      url: payment.employee.phone ? buildWhatsAppUrl(payment.employee.phone, message) : null,
    },
  });
}
