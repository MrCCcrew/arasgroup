import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createJournalEntry, getCurrentFiscalYear } from "@/lib/accounting/journal-engine";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";

const transferSchema = z.object({
  sourceBankAccountId: z.string(),
  destinationBankAccountId: z.string(),
  companyId: z.string().optional(),
  branchId: z.string().optional(),
  investorId: z.string().optional(),
  amount: z.number().positive(),
  transferDate: z.string().transform((value) => new Date(value)),
  purposeAr: z.string().min(3, "الغرض العربي مطلوب"),
  purposeEn: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
  }

  const permissionError = assertPermission(session, "BANKS", "VIEW", { companyId });
  if (permissionError) return permissionError;

  const data = await prisma.accountTransfer.findMany({
    where: { companyId },
    orderBy: { transferDate: "desc" },
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data = parsed.data;
  const source = await prisma.bankAccount.findUnique({ where: { id: data.sourceBankAccountId } });
  const destination = await prisma.bankAccount.findUnique({ where: { id: data.destinationBankAccountId } });

  if (!source || !destination) {
    return NextResponse.json({ success: false, error: "الحساب البنكي المصدر أو الوجهة غير موجود" }, { status: 400 });
  }

  const permissionError = assertPermission(session, "BANKS", "CREATE", { companyId: source.companyId });
  if (permissionError) return permissionError;

  const [sourceChart, destinationChart] = await Promise.all([
    source.chartAccountId ? prisma.chartOfAccount.findUnique({ where: { id: source.chartAccountId } }) : null,
    destination.chartAccountId ? prisma.chartOfAccount.findUnique({ where: { id: destination.chartAccountId } }) : null,
  ]);

  if (!sourceChart || !destinationChart) {
    return NextResponse.json({ success: false, error: "يجب ربط الحسابين البنكيين بدليل الحسابات" }, { status: 400 });
  }

  const fiscalYearId = await getCurrentFiscalYear(source.companyId);
  const entry = await createJournalEntry({
    companyId: source.companyId,
    fiscalYearId,
    date: data.transferDate,
    descriptionAr: data.purposeAr,
    descriptionEn: data.purposeEn,
    type: "TRANSFER",
    reference: data.reference,
    refModule: "account_transfers",
    refId: `${data.sourceBankAccountId}:${data.destinationBankAccountId}:${data.transferDate.toISOString()}`,
    isAutomatic: false,
    createdById: session.id,
    lines: [
      { accountId: destinationChart.id, debit: data.amount, credit: 0, descriptionAr: data.purposeAr, branchId: data.branchId },
      { accountId: sourceChart.id, debit: 0, credit: data.amount, descriptionAr: data.purposeAr, branchId: data.branchId },
    ],
  });

  const transfer = await prisma.accountTransfer.create({
    data: {
      sourceBankAccountId: data.sourceBankAccountId,
      destinationBankAccountId: data.destinationBankAccountId,
      companyId: data.companyId ?? source.companyId,
      branchId: data.branchId,
      investorId: data.investorId,
      amount: data.amount,
      transferDate: data.transferDate,
      purposeAr: data.purposeAr,
      purposeEn: data.purposeEn,
      reference: data.reference,
      journalEntryId: entry.id,
      createdById: session.id,
      notes: data.notes,
    },
  });

  return NextResponse.json({ success: true, data: transfer }, { status: 201 });
}
