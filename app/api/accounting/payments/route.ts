import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry } from "@/lib/accounting/journal-engine";

const schema = z.object({
  companyId: z.string(),
  date: z.string().transform((s) => new Date(s)),
  descriptionAr: z.string().min(3, "البيان مطلوب"),
  amount: z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  paymentMethod: z.enum(["CASH", "BANK"]),
  bankAccountId: z.string().optional(),
  cashAccountCode: z.string().default("1000"),
  bankAccountCode: z.string().default("1010"),
  debitAccountId: z.string(),
  reference: z.string().optional(),
  partyName: z.string().optional(),
});

async function resolveCreditAccount(params: {
  companyId: string;
  paymentMethod: "CASH" | "BANK";
  bankAccountId?: string;
  cashAccountCode: string;
  bankAccountCode: string;
}) {
  if (params.paymentMethod === "BANK" && params.bankAccountId) {
    const bankAccount = await prisma.bankAccount.findFirst({
      where: {
        id: params.bankAccountId,
        companyId: params.companyId,
        isActive: true,
      },
      include: { chartAccount: true },
    });
    return bankAccount?.chartAccount ?? null;
  }

  const code = params.paymentMethod === "CASH" ? params.cashAccountCode : params.bankAccountCode;
  return prisma.chartOfAccount.findUnique({
    where: { companyId_code: { companyId: params.companyId, code } },
  });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, parsed.data.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "CREATE", {
      companyId: parsed.data.companyId,
    });
    if (permissionError) return permissionError;

    const {
      companyId,
      date,
      descriptionAr,
      amount,
      paymentMethod,
      bankAccountId,
      cashAccountCode,
      bankAccountCode,
      debitAccountId,
      reference,
      partyName,
    } = parsed.data;

    const [creditAccount, debitAccount] = await Promise.all([
      resolveCreditAccount({
        companyId,
        paymentMethod,
        bankAccountId,
        cashAccountCode,
        bankAccountCode,
      }),
      prisma.chartOfAccount.findFirst({
        where: { id: debitAccountId, companyId, isActive: true },
      }),
    ]);

    if (!creditAccount) {
      return NextResponse.json(
        {
          success: false,
          error:
            paymentMethod === "BANK" && bankAccountId
              ? "الحساب البنكي المختار غير مربوط بدليل الحسابات أو غير موجود"
              : `الحساب برقم ${paymentMethod === "CASH" ? cashAccountCode : bankAccountCode} غير موجود`,
        },
        { status: 400 },
      );
    }

    if (!debitAccount) {
      return NextResponse.json({ success: false, error: "الحساب المدين غير موجود" }, { status: 400 });
    }

    const description = partyName ? `${descriptionAr} - ${partyName}` : descriptionAr;

    const entry = await createJournalEntry({
      companyId,
      date,
      descriptionAr: description,
      type: "PAYMENT",
      reference,
      isAutomatic: false,
      createdById: session.id,
      lines: [
        { accountId: debitAccount.id, debit: amount, credit: 0, descriptionAr: description },
        {
          accountId: creditAccount.id,
          debit: 0,
          credit: amount,
          descriptionAr: paymentMethod === "CASH" ? "نقدي" : "بنك",
        },
      ],
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إنشاء سند الصرف";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
