import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ transactionId: string }> }

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { transactionId } = await params;
    const tx = await prisma.driverWalletTransaction.findUnique({
      where: { id: transactionId },
      include: { driver: { include: { employee: { select: { companyId: true } } } } },
    });
    if (!tx) return NextResponse.json({ success: false, error: "الحركة غير موجودة" }, { status: 404 });

    await prisma.$transaction(async (trx) => {
      // عكس المبلغ على رصيد المحفظة
      await trx.driver.update({
        where: { id: tx.driverId },
        data: { walletBalance: { decrement: tx.amount } },
      });
      await trx.driverWalletTransaction.delete({ where: { id: transactionId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في حذف الحركة" }, { status: 500 });
  }
}
