import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Ctx { params: Promise<{ violationId: string }> }

const schema = z.object({
  batchId: z.string().min(1),
  salaryPaymentId: z.string().min(1),
  employeeId: z.string().min(1),
  amount: z.number().min(0.001),
});

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { violationId } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const violation = await prisma.driverViolation.findUnique({
      where: { id: violationId },
      select: {
        companyId: true, type: true, amount: true, responsibility: true,
        driverSharePct: true, paymentMode: true, installmentMonths: true,
        installmentsPaid: true, status: true,
      },
    });
    if (!violation) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });
    if (violation.status === "SETTLED" || violation.status === "CANCELLED") {
      return NextResponse.json({ success: false, error: "المخالفة مغلقة" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, violation.companyId);
    if (companyAccessError) return companyAccessError;

    const newPaid = violation.installmentsPaid + 1;
    const totalInstallments = violation.paymentMode === "INSTALLMENT" ? (violation.installmentMonths ?? 1) : 1;
    const isFullyPaid = newPaid >= totalInstallments;

    await prisma.$transaction(async (tx) => {
      await tx.salaryItem.create({
        data: {
          batchId: parsed.data.batchId,
          salaryPaymentId: parsed.data.salaryPaymentId,
          employeeId: parsed.data.employeeId,
          type: "DEDUCTION",
          category: "VIOLATION",
          titleAr: `خصم مخالفة — ${violation.type}`,
          titleEn: `Violation deduction — ${violation.type}`,
          amount: parsed.data.amount,
          sourceType: "VIOLATION",
          sourceId: violationId,
        },
      });

      await tx.driverViolation.update({
        where: { id: violationId },
        data: {
          installmentsPaid: newPaid,
          status: isFullyPaid ? "SETTLED" : "PENDING",
        },
      });
    });

    return NextResponse.json({ success: true, fullyPaid: isFullyPaid });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تسجيل الخصم" }, { status: 500 });
  }
}
