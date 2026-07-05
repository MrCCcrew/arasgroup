import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createDriverWalletDepositJE } from "@/lib/accounting/auto-entries";
import { getDriverWalletStatement } from "@/lib/accounting/reports";
import { recomputeDriverWalletState } from "@/lib/delivery/wallet-state";

const walletDepositSchema = z.object({
  driverId: z.string(),
  companyId: z.string(),
  amount: z.number().positive("المبلغ يجب أن يكون موجباً"),
  date: z.string().transform((s) => new Date(s)),
  paymentMethod: z.enum(["CASH", "BANK"]).optional(),
  isBankDeposit: z.boolean().optional(),
  bankAccountId: z.string().nullable().optional(),
  descriptionAr: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("driverId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    const companyId = searchParams.get("companyId");

    // Build date filter
    let dateFilter = {};
    if (month && year) {
      const monthNum = Number.parseInt(month, 10);
      const yearNum = Number.parseInt(year, 10);
      const start = new Date(yearNum, monthNum - 1, 1, 0, 0, 0, 0);
      const end = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);
      dateFilter = { date: { gte: start, lte: end } };
    } else if (year) {
      const yearNum = Number.parseInt(year, 10);
      const start = new Date(yearNum, 0, 1, 0, 0, 0, 0);
      const end = new Date(yearNum, 11, 31, 23, 59, 59, 999);
      dateFilter = { date: { gte: start, lte: end } };
    } else if (startDate && endDate) {
      dateFilter = { date: { gte: new Date(startDate), lte: new Date(endDate) } };
    }

    if (!driverId && companyId) {
      const [transactions, summary] = await Promise.all([
        prisma.driverWalletTransaction.findMany({
          where: {
            driver: { employee: { companyId } },
            ...dateFilter,
          },
          include: { driver: { include: { employee: { select: { nameAr: true } } } } },
          orderBy: { createdAt: "desc" },
          take: 500,
        }),
        // مجاميع لكل سائق حسب نوع الحركة (للتوفيق: محصّل/مودَع/المتبقّي)
        prisma.driverWalletTransaction.groupBy({
          by: ["driverId", "type"],
          where: {
            driver: { employee: { companyId } },
            ...dateFilter,
          },
          _sum: { amount: true },
        }),
      ]);
      const summaryRows = summary.map((s) => ({ driverId: s.driverId, type: s.type, amount: Number(s._sum.amount ?? 0) }));
      return NextResponse.json({ success: true, data: { transactions, summary: summaryRows } });
    }

    if (!driverId) {
      return NextResponse.json({ success: false, error: "driverId مطلوب" }, { status: 400 });
    }

    const statement = await getDriverWalletStatement(
      driverId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return NextResponse.json({ success: true, data: statement });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب حركات المحفظة" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const userId = session.id;
    const body = await request.json();
    const parsed = walletDepositSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const paymentMethod = data.paymentMethod ?? (data.isBankDeposit ? "BANK" : "CASH");

    const result = await prisma.$transaction(async (tx) => {
      const walletTx = await tx.driverWalletTransaction.create({
        data: {
          driverId: data.driverId,
          type: "DEPOSIT",
          amount: data.amount,
          date: data.date,
          paymentMethod,
          bankAccountId: paymentMethod === "BANK" ? data.bankAccountId : null,
          descriptionAr: data.descriptionAr ?? "إيداع محفظة سائق",
        },
      });

      const je = await createDriverWalletDepositJE({
        companyId: data.companyId,
        userId,
        driverId: data.driverId,
        amount: data.amount,
        isBankDeposit: paymentMethod === "BANK",
        bankAccountId: paymentMethod === "BANK" ? data.bankAccountId : null,
        refId: walletTx.id,
        descriptionAr: data.descriptionAr ?? `إيداع محفظة سائق - ${data.amount.toFixed(3)} د.ك`,
        date: data.date,
      });

      await tx.driverWalletTransaction.update({
        where: { id: walletTx.id },
        data: { journalEntryId: je.id },
      });

      await recomputeDriverWalletState(tx, data.driverId);
      return walletTx;
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تسجيل الإيداع";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
