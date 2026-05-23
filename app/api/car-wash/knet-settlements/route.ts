import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createKnetSettlementJE } from "@/lib/accounting/auto-entries";
import { z } from "zod";

const createSettlementSchema = z.object({
  companyId: z.string(),
  bankAccountId: z.string(),
  settlementDate: z.string().transform((s) => new Date(s)),
  grossAmount: z.number().positive(),
  commission: z.number().min(0),
  transactionIds: z.array(z.string()),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = createSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const netAmount = data.grossAmount - data.commission;

    const settlement = await prisma.$transaction(async (tx) => {
      // Create settlement record
      const settlement = await tx.knetSettlement.create({
        data: {
          companyId: data.companyId,
          bankAccountId: data.bankAccountId,
          settlementDate: data.settlementDate,
          grossAmount: data.grossAmount,
          commission: data.commission,
          netAmount,
          notes: data.notes,
        },
      });

      // Link KNET transactions to this settlement
      await tx.knetTransaction.updateMany({
        where: { id: { in: data.transactionIds } },
        data: { settlementId: settlement.id, isSettled: true },
      });

      // Create accounting JE
      const je = await createKnetSettlementJE({
        companyId: data.companyId,
        userId,
        grossAmount: data.grossAmount,
        commission: data.commission,
        netAmount,
        refId: settlement.id,
        date: data.settlementDate,
      });

      await tx.knetSettlement.update({
        where: { id: settlement.id },
        data: { journalEntryId: je.id },
      });

      return settlement;
    });

    return NextResponse.json({ success: true, data: settlement }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء التسوية";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const settlements = await prisma.knetSettlement.findMany({
      where: { ...(companyId ? { companyId } : {}) },
      include: {
        bankAccount: { select: { nameAr: true, bankName: true } },
        transactions: { select: { id: true, amount: true } },
      },
      orderBy: { settlementDate: "desc" },
    });

    return NextResponse.json({ success: true, data: settlements });
  } catch (error) {
    return NextResponse.json({ success: false, error: "فشل في جلب التسويات" }, { status: 500 });
  }
}
