import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { recomputeDriverWalletStates } from "@/lib/delivery/wallet-state";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

interface Props {
  params: Promise<{ reportId: string }>;
}

const reportLineSchema = z.object({
  driverId: z.string(),
  ordersCount: z.number().int().min(0),
  ratePerOrder: z.number().min(0),
  grossAmount: z.number().min(0),
  walletDeducted: z.number().min(0).default(0),
  netAmount: z.number().min(0),
  tips: z.number().optional(),
  notes: z.string().optional(),
});

const patchSchema = z.object({
  contractId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  reportDate: z.string().transform((s) => new Date(s)),
  lines: z.array(reportLineSchema),
  notes: z.string().optional().nullable(),
});

const walletDeductionDesc = (month: number, year: number) => `خصم محفظة شهر ${month}/${year}`;

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { reportId } = await params;
  const report = await prisma.deliveryMonthlyReport.findUnique({
    where: { id: reportId },
    include: {
      contract: { select: { nameAr: true, nameEn: true, platform: true } },
      lines: { include: { driver: { include: { employee: { select: { nameAr: true } } } } } },
    },
  });

  if (!report) {
    return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  }

  const err = assertCompanyAccess(session, report.companyId);
  if (err) return err;

  return NextResponse.json({ success: true, data: report });
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { reportId } = await params;
    const existing = await prisma.deliveryMonthlyReport.findUnique({
      where: { id: reportId },
      select: { id: true, companyId: true, contractId: true, month: true, year: true, lines: { select: { driverId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
    }

    const err = assertCompanyAccess(session, existing.companyId);
    if (err) return err;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const totalOrders = data.lines.reduce((sum, line) => sum + line.ordersCount, 0);
    const totalGross = data.lines.reduce((sum, line) => sum + line.grossAmount, 0);
    const totalWallet = data.lines.reduce((sum, line) => sum + line.walletDeducted, 0);
    const netPayment = totalGross - totalWallet;

    const updated = await prisma.$transaction(async (tx) => {
      const previousWalletTransactions = await tx.driverWalletTransaction.findMany({
        where: {
          contractId: existing.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(existing.month, existing.year),
        },
        select: { driverId: true },
      });

      await tx.driverWalletTransaction.deleteMany({
        where: {
          contractId: existing.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(existing.month, existing.year),
        },
      });

      await tx.deliveryMonthlyReportLine.deleteMany({ where: { reportId } });

      const report = await tx.deliveryMonthlyReport.update({
        where: { id: reportId },
        data: {
          contractId: data.contractId,
          month: data.month,
          year: data.year,
          reportDate: data.reportDate,
          totalOrdersCount: totalOrders,
          totalGrossAmount: totalGross,
          totalWalletDeducted: totalWallet,
          netPayment,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((line) => ({
              driverId: line.driverId,
              ordersCount: line.ordersCount,
              ratePerOrder: line.ratePerOrder,
              grossAmount: line.grossAmount,
              walletDeducted: line.walletDeducted,
              netAmount: line.netAmount,
              tips: line.tips,
              notes: line.notes,
            })),
          },
        },
        include: { lines: true, contract: true },
      });

      const affectedDrivers = new Set<string>([
        ...existing.lines.map((line) => line.driverId),
        ...previousWalletTransactions.map((line) => line.driverId),
      ]);

      for (const line of data.lines) {
        if (line.walletDeducted > 0) {
          await tx.driverWalletTransaction.create({
            data: {
              driverId: line.driverId,
              contractId: data.contractId,
              type: "DEDUCTION",
              amount: line.walletDeducted,
              date: data.reportDate,
              descriptionAr: walletDeductionDesc(data.month, data.year),
            },
          });
          affectedDrivers.add(line.driverId);
        }
      }

      await recomputeDriverWalletStates(tx, affectedDrivers);
      return report;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { reportId } = await params;
    const report = await prisma.deliveryMonthlyReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        companyId: true,
        contractId: true,
        month: true,
        year: true,
        journalEntryId: true,
        lines: { select: { driverId: true } },
        _count: { select: { payments: true } },
      },
    });
    if (!report) {
      return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
    }

    const err = assertCompanyAccess(session, report.companyId);
    if (err) return err;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    if (report._count.payments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن حذف التقرير لوجود دفعة شركة مرتبطة به. احذف الدفعة أولاً ثم أعد المحاولة.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const removedWalletTransactions = await tx.driverWalletTransaction.findMany({
        where: {
          contractId: report.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(report.month, report.year),
        },
        select: { driverId: true },
      });

      await tx.driverWalletTransaction.deleteMany({
        where: {
          contractId: report.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(report.month, report.year),
        },
      });

      await discardLinkedJournalEntry(tx, report.journalEntryId, {
        userId: session.id,
        reasonAr: "تم حذف التقرير الشهري المرتبط قبل ترحيل القيد",
      });

      await tx.deliveryMonthlyReport.delete({ where: { id: reportId } });

      await recomputeDriverWalletStates(tx, [
        ...report.lines.map((line) => line.driverId),
        ...removedWalletTransactions.map((line) => line.driverId),
      ]);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
