import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

const schema = z.object({
  companyId: z.string().min(1),
  bankAccountId: z.string().min(1),
});

/**
 * تصحيح لمرة واحدة: ينقل سطر البنك في قيود إيداعات السائقين القديمة المرحّلة
 * على حساب البنك العام (1010) إلى حساب البنك المحدّد (بنك التوريدات)، ويربط
 * الحركة بالحساب البنكي. لا يغيّر المبالغ — مجرد إعادة تصنيف لحساب البنك الصحيح.
 */
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const { companyId, bankAccountId } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const [bank, generalBank] = await Promise.all([
      prisma.bankAccount.findFirst({
        where: { id: bankAccountId, companyId, isActive: true },
        select: { chartAccountId: true },
      }),
      prisma.chartOfAccount.findUnique({
        where: { companyId_code: { companyId, code: "1010" } },
        select: { id: true },
      }),
    ]);

    if (!bank?.chartAccountId) {
      return NextResponse.json({ success: false, error: "الحساب البنكي المختار غير مربوط بدليل الحسابات" }, { status: 400 });
    }
    if (!generalBank) {
      return NextResponse.json({ success: false, error: "حساب البنك العام (1010) غير موجود" }, { status: 400 });
    }
    const targetChartId = bank.chartAccountId;
    if (targetChartId === generalBank.id) {
      return NextResponse.json({ success: true, reclassified: 0, message: "البنك المختار هو نفسه الحساب العام (1010) — لا حاجة للتصحيح." });
    }

    // إيداعات بنكية قديمة بدون حساب بنكي محدّد ولها قيد مرتبط؛ نصحّح فقط ما له
    // سطر بنك على الحساب العام (1010) — وهذا ما تضمنه شرط updateMany بالأسفل.
    const deposits = await prisma.driverWalletTransaction.findMany({
      where: {
        type: "DEPOSIT",
        bankAccountId: null,
        journalEntryId: { not: null },
        driver: { employee: { companyId } },
      },
      select: { id: true, journalEntryId: true },
    });

    let reclassified = 0;
    await prisma.$transaction(async (tx) => {
      for (const d of deposits) {
        // ننقل سطر البنك (المدين على 1010) إلى حساب بنك التوريدات
        const updated = await tx.journalEntryLine.updateMany({
          where: { journalEntryId: d.journalEntryId!, accountId: generalBank.id, debit: { gt: 0 } },
          data: { accountId: targetChartId },
        });
        if (updated.count > 0) {
          await tx.driverWalletTransaction.update({ where: { id: d.id }, data: { bankAccountId } });
          reclassified += 1;
        }
      }
    });

    return NextResponse.json({ success: true, reclassified });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تصحيح الإيداعات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
