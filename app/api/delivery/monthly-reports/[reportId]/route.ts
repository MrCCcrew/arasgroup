import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

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
  rating: z.number().optional(),
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

// ── GET — load a single report (used by the edit page) ──────────────────────
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

  if (!report) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });

  const err = assertCompanyAccess(session, report.companyId);
  if (err) return err;

  return NextResponse.json({ success: true, data: report });
}

// ── PATCH — replace report lines, recompute totals, re-sync wallet deductions ─
export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { reportId } = await params;
    const existing = await prisma.deliveryMonthlyReport.findUnique({
      where: { id: reportId },
      select: { id: true, companyId: true, contractId: true, month: true, year: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });

    const err = assertCompanyAccess(session, existing.companyId);
    if (err) return err;

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const data = parsed.data;

    const totalOrders = data.lines.reduce((s, l) => s + l.ordersCount, 0);
    const totalGross = data.lines.reduce((s, l) => s + l.grossAmount, 0);
    const totalWallet = data.lines.reduce((s, l) => s + l.walletDeducted, 0);
    const netPayment = totalGross - totalWallet;

    const updated = await prisma.$transaction(async (tx) => {
      // Reverse the OLD wallet deductions tied to this report (matched by old contract/month/year)
      await tx.driverWalletTransaction.deleteMany({
        where: {
          contractId: existing.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(existing.month, existing.year),
        },
      });

      // Replace lines
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

      // Re-create wallet deductions for the new lines (using new contract/month/year)
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
        }
      }

      return report;
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

// ── DELETE — remove report, reverse wallet deductions, cancel journal entry ──
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
        _count: { select: { payments: true } },
      },
    });
    if (!report) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });

    const err = assertCompanyAccess(session, report.companyId);
    if (err) return err;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    // A linked company payment is a separate financial record — block and ask to remove it first
    if (report._count.payments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن حذف التقرير لوجود مدفوعة شركة مرتبطة به. احذف المدفوعة أولاً من صفحة مدفوعات الشركة ثم أعد المحاولة.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // Reverse the wallet deductions created when the report was created
      await tx.driverWalletTransaction.deleteMany({
        where: {
          contractId: report.contractId,
          type: "DEDUCTION",
          descriptionAr: walletDeductionDesc(report.month, report.year),
        },
      });

      // Cancel the linked journal entry, if any
      if (report.journalEntryId) {
        await tx.journalEntry.update({
          where: { id: report.journalEntryId },
          data: { status: "CANCELLED", descriptionAr: "ملغى — تم حذف التقرير الشهري المرتبط" },
        });
      }

      // Delete the report (lines cascade-delete)
      await tx.deliveryMonthlyReport.delete({ where: { id: reportId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
