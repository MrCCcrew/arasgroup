import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry } from "@/lib/accounting/journal-engine";
import { z } from "zod";

const schema = z.object({
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  descriptionAr: z.string().min(3, "البيان مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentMethod: z.enum(["CASH", "BANK"]),
  cashAccountCode: z.string().default("1000"),
  bankAccountCode: z.string().default("1010"),
  debitAccountId: z.string(),            // chart of account ID to debit
  reference: z.string().optional(),
  partyName: z.string().optional(),      // paid to
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const {
      companyId, date, descriptionAr, amount,
      paymentMethod, cashAccountCode, bankAccountCode,
      debitAccountId, reference, partyName,
    } = parsed.data;

    const creditCode = paymentMethod === "CASH" ? cashAccountCode : bankAccountCode;
    const creditAccount = await prisma.chartOfAccount.findUnique({
      where: { companyId_code: { companyId, code: creditCode } },
    });
    if (!creditAccount) {
      return NextResponse.json({ success: false, error: `الحساب برقم ${creditCode} غير موجود` }, { status: 400 });
    }

    const debitAccount = await prisma.chartOfAccount.findUnique({
      where: { id: debitAccountId },
    });
    if (!debitAccount) {
      return NextResponse.json({ success: false, error: "الحساب المدين غير موجود" }, { status: 400 });
    }

    const desc = partyName ? `${descriptionAr} — ${partyName}` : descriptionAr;

    const entry = await createJournalEntry({
      companyId,
      date,
      descriptionAr: desc,
      type: "PAYMENT",
      reference,
      isAutomatic: false,
      createdById: userId,
      lines: [
        { accountId: debitAccountId, debit: amount, credit: 0, descriptionAr: desc },
        { accountId: creditAccount.id, debit: 0, credit: amount, descriptionAr: paymentMethod === "CASH" ? "نقدي" : "بنك" },
      ],
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء سند الصرف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
