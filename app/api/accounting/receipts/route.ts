import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry, getCurrentFiscalYear } from "@/lib/accounting/journal-engine";
import { z } from "zod";

const schema = z.object({
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  descriptionAr: z.string().min(3, "البيان مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentMethod: z.enum(["CASH", "BANK"]),
  bankAccountId: z.string().optional(),  // bank account record ID
  cashAccountCode: z.string().default("1000"),  // chart of account code for cash
  bankAccountCode: z.string().default("1010"),  // chart of account code for bank
  creditAccountId: z.string(),           // chart of account ID to credit
  reference: z.string().optional(),
  partyName: z.string().optional(),      // received from
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
      paymentMethod, bankAccountId,
      cashAccountCode, bankAccountCode,
      creditAccountId, reference, partyName,
    } = parsed.data;

    // Resolve the debit account (cash or bank chart-of-account)
    const debitCode = paymentMethod === "CASH" ? cashAccountCode : bankAccountCode;
    const debitAccount = await prisma.chartOfAccount.findUnique({
      where: { companyId_code: { companyId, code: debitCode } },
    });
    if (!debitAccount) {
      return NextResponse.json({ success: false, error: `الحساب برقم ${debitCode} غير موجود` }, { status: 400 });
    }

    const creditAccount = await prisma.chartOfAccount.findUnique({
      where: { id: creditAccountId },
    });
    if (!creditAccount) {
      return NextResponse.json({ success: false, error: "الحساب الدائن غير موجود" }, { status: 400 });
    }

    const desc = partyName ? `${descriptionAr} — ${partyName}` : descriptionAr;

    const entry = await createJournalEntry({
      companyId,
      date,
      descriptionAr: desc,
      type: "RECEIPT",
      reference,
      isAutomatic: false,
      createdById: userId,
      lines: [
        { accountId: debitAccount.id, debit: amount, credit: 0, descriptionAr: paymentMethod === "CASH" ? "نقدي" : "بنك" },
        { accountId: creditAccountId, debit: 0, credit: amount, descriptionAr: desc },
      ],
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء سند القبض";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
