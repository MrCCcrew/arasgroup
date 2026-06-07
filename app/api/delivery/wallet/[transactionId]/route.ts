import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { recomputeDriverWalletState } from "@/lib/delivery/wallet-state";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Ctx {
  params: Promise<{ transactionId: string }>;
}

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
    if (!tx) {
      return NextResponse.json({ success: false, error: "الحركة غير موجودة" }, { status: 404 });
    }

    await prisma.$transaction(async (trx) => {
      await discardLinkedJournalEntry(trx, tx.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف حركة محفظة السائق المرتبطة قبل ترحيل القيد",
      });
      await trx.driverWalletTransaction.delete({ where: { id: transactionId } });
      await recomputeDriverWalletState(trx, tx.driverId);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في حذف الحركة" }, { status: 500 });
  }
}
