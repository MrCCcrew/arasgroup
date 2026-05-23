import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createInvestorSalaryCollectionJE, createInvestorSalaryDisbursementJE } from "@/lib/accounting/auto-entries";
import { z } from "zod";

const createCollectionSchema = z.object({
  investorId: z.string(),
  branchId: z.string().optional(),
  companyId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  collectedAmount: z.number().positive(),
  collectedDate: z.string().transform((s) => new Date(s)),
  bankAccountId: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const investorId = searchParams.get("investorId");

    const collections = await prisma.investorSalaryCollection.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(investorId ? { investorId } : {}),
      },
      include: {
        investor: { select: { nameAr: true } },
        salaryPayments: {
          include: { employee: { select: { nameAr: true } } },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ success: true, data: collections });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب تحصيلات الرواتب" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = createCollectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    const collection = await prisma.$transaction(async (tx) => {
      const collection = await tx.investorSalaryCollection.create({
        data: {
          investorId: data.investorId,
          branchId: data.branchId,
          companyId: data.companyId,
          month: data.month,
          year: data.year,
          collectedAmount: data.collectedAmount,
          collectedDate: data.collectedDate,
          bankAccountId: data.bankAccountId,
          notes: data.notes,
          status: "COLLECTED",
        },
      });

      // Auto JE — liability entry (NOT revenue)
      const investor = await tx.investor.findUnique({ where: { id: data.investorId } });
      const je = await createInvestorSalaryCollectionJE({
        companyId: data.companyId,
        userId,
        investorId: data.investorId,
        amount: data.collectedAmount,
        refId: collection.id,
        descriptionAr: `تحصيل رواتب من مستثمر: ${investor?.nameAr} — شهر ${data.month}/${data.year}`,
      });

      await tx.investorSalaryCollection.update({
        where: { id: collection.id },
        data: { journalEntryId: je.id },
      });

      return collection;
    });

    return NextResponse.json({ success: true, data: collection }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تسجيل التحصيل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
