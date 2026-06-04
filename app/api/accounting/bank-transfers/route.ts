import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

const transferSchema = z.object({
  companyId: z.string(),
  sourceBankAccountId: z.string(),
  destinationBankAccountId: z.string(),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً"),
  transferDate: z.string().transform((s) => new Date(s)),
  purposeAr: z.string().min(1, "الغرض مطلوب"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // التحقق من أن البنكين مختلفين
    if (data.sourceBankAccountId === data.destinationBankAccountId) {
      return NextResponse.json(
        { success: false, error: "البنك المحول منه والمحول إليه يجب أن يكونا مختلفين" },
        { status: 400 }
      );
    }

    // التحقق من أن البنوك تنتمي للشركة
    const [sourceBank, destBank] = await Promise.all([
      prisma.bankAccount.findFirst({
        where: { id: data.sourceBankAccountId, companyId: data.companyId },
      }),
      prisma.bankAccount.findFirst({
        where: { id: data.destinationBankAccountId, companyId: data.companyId },
      }),
    ]);

    if (!sourceBank || !destBank) {
      return NextResponse.json(
        { success: false, error: "أحد البنوك المحددة غير موجود" },
        { status: 400 }
      );
    }

    // إنشاء التحويل
    const transfer = await prisma.accountTransfer.create({
      data: {
        sourceBankAccountId: data.sourceBankAccountId,
        destinationBankAccountId: data.destinationBankAccountId,
        companyId: data.companyId,
        amount: data.amount,
        transferDate: data.transferDate,
        purposeAr: data.purposeAr,
        reference: data.reference,
        notes: data.notes,
        createdById: userId,
      },
    });

    return NextResponse.json({ success: true, data: transfer }, { status: 201 });
  } catch (error) {
    console.error("Bank transfer error:", error);
    const msg = error instanceof Error ? error.message : "فشل في تسجيل التحويل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
