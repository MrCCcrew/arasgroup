import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ paymentId: string }>;
}

// حذف تحصيل من دفعة رواتب — مرجعي فقط.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { paymentId } = await params;
    const payment = await prisma.managerSalaryPayment.findUnique({
      where: { id: paymentId },
      select: { id: true, batch: { select: { companyId: true } } },
    });
    if (!payment) return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, payment.batch.companyId);
    if (accessError) return accessError;
    await prisma.managerSalaryPayment.delete({ where: { id: paymentId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في الحذف" }, { status: 400 });
  }
}
