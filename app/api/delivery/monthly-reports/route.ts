import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { createDeliveryPaymentJE } from "@/lib/accounting/auto-entries";
import { z } from "zod";

const reportLineSchema = z.object({
  driverId: z.string(),
  ordersCount: z.number().int().min(0),
  ratePerOrder: z.number().min(0),
  grossAmount: z.number().min(0),
  walletDeducted: z.number().min(0).default(0),
  netAmount: z.number().min(0),
  rating: z.number().optional(),
  notes: z.string().optional(),
});

const createReportSchema = z.object({
  contractId: z.string(),
  companyId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  reportDate: z.string().transform((s) => new Date(s)),
  lines: z.array(reportLineSchema),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const contractId = searchParams.get("contractId");
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    const reports = await prisma.deliveryMonthlyReport.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        ...(contractId ? { contractId } : {}),
        ...(month ? { month: parseInt(month) } : {}),
        ...(year ? { year: parseInt(year) } : {}),
      },
      include: {
        contract: { select: { platform: true, nameAr: true } },
        lines: {
          include: { driver: { include: { employee: { select: { nameAr: true } } } } },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب التقارير" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json();
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    const totalOrders = data.lines.reduce((s, l) => s + l.ordersCount, 0);
    const totalGross = data.lines.reduce((s, l) => s + l.grossAmount, 0);
    const totalWallet = data.lines.reduce((s, l) => s + l.walletDeducted, 0);
    const netPayment = totalGross - totalWallet;

    const report = await prisma.$transaction(async (tx) => {
      const report = await tx.deliveryMonthlyReport.create({
        data: {
          contractId: data.contractId,
          companyId: data.companyId,
          month: data.month,
          year: data.year,
          reportDate: data.reportDate,
          totalOrdersCount: totalOrders,
          totalGrossAmount: totalGross,
          totalWalletDeducted: totalWallet,
          netPayment,
          notes: data.notes,
          lines: {
            create: data.lines.map((l) => ({
              driverId: l.driverId,
              ordersCount: l.ordersCount,
              ratePerOrder: l.ratePerOrder,
              grossAmount: l.grossAmount,
              walletDeducted: l.walletDeducted,
              netAmount: l.netAmount,
              rating: l.rating,
              notes: l.notes,
            })),
          },
        },
        include: { lines: true, contract: true },
      });

      // Update driver wallet balances
      for (const line of data.lines) {
        if (line.walletDeducted > 0) {
          await tx.driverWalletTransaction.create({
            data: {
              driverId: line.driverId,
              contractId: data.contractId,
              type: "DEDUCTION",
              amount: line.walletDeducted,
              date: data.reportDate,
              descriptionAr: `خصم محفظة شهر ${data.month}/${data.year}`,
            },
          });
        }
      }

      return report;
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء التقرير";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
