import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ importId: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const body = await request.json().catch(() => ({}));
  const forceReplace = body.forceReplace === true;

  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId },
    include: {
      riders: { include: { allocations: true } },
    },
  });
  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  if (imp.status === "POSTED") return NextResponse.json({ success: false, error: "التقرير مرحّل بالفعل" }, { status: 400 });
  if (imp.status === "CANCELLED") return NextResponse.json({ success: false, error: "التقرير ملغي" }, { status: 400 });

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  // Validate all riders are matched or allocated
  const unresolved = imp.riders.filter(
    (r) => r.matchingStatus === "UNMATCHED" || r.matchingStatus === "SHARED_ID_NEEDS_ALLOCATION"
  );
  if (unresolved.length > 0) {
    return NextResponse.json({
      success: false,
      error: `لا يمكن ترحيل التقرير قبل توزيع كل الطلبات على السائقين. يوجد ${unresolved.length} سائق غير مطابق. / Cannot post the report before all orders are allocated to drivers.`,
      unresolvedCount: unresolved.length,
    }, { status: 400 });
  }

  // Validate all matched/allocated riders have allocations
  for (const rider of imp.riders) {
    if (rider.allocations.length === 0) {
      return NextResponse.json({
        success: false,
        error: `السائق ${rider.talabatRiderName} (${rider.talabatRiderId}) ليس لديه توزيع. / Rider ${rider.talabatRiderName} has no allocation.`,
      }, { status: 400 });
    }
  }

  // Build driver allocations map: driverId → { orders, pickupPay, dropoffPay, payment, notes, ... }
  const driverAllocs = new Map<string, {
    orders: number; pickupPay: number; dropoffPay: number;
    payment: number; notes: string[]; riderId: string; riderName: string;
    // NEW: Carriage fields
    actualCompletedDeliveries?: number;
    evaluatedHours?: number;
    achievementPayment?: number;
    operatorDeduction?: number;
    netCost?: number;
    hasOperatorDeduction?: boolean;
  }>();

  for (const rider of imp.riders) {
    const isCarriage = (rider as any).reportType === "CARRIAGE_CSV";
    const riderOrders = Number(rider.calculatedOrdersRounded);
    const riderPickup = Number(rider.totalPickupPay);
    const riderDropoff = Number(rider.totalDropoffPay);
    const riderPayment = Number(rider.totalPayment);

    // Carriage-specific fields
    const riderActualOrders = isCarriage ? Number((rider as any).actualCompletedDeliveries || 0) : 0;
    const riderEvaluatedHours = isCarriage ? Number((rider as any).evaluatedHours || 0) : 0;
    const riderAchievement = isCarriage ? Number((rider as any).achievementPayment || 0) : 0;
    const riderOperatorDeduction = isCarriage ? Number((rider as any).operatorDeduction || 0) : 0;
    const riderNetCost = isCarriage ? Number((rider as any).netCost || 0) : 0;
    const hasOperatorDed = isCarriage ? Boolean((rider as any).hasOperatorDeduction) : false;

    for (const alloc of rider.allocations) {
      const share = riderOrders > 0 ? Number(alloc.allocatedOrders) / riderOrders : 0;
      const existing = driverAllocs.get(alloc.driverId) ?? {
        orders: 0, pickupPay: 0, dropoffPay: 0, payment: 0,
        notes: [], riderId: rider.talabatRiderId, riderName: rider.talabatRiderName,
        actualCompletedDeliveries: 0,
        evaluatedHours: 0,
        achievementPayment: 0,
        operatorDeduction: 0,
        netCost: 0,
        hasOperatorDeduction: false,
      };
      existing.orders += Number(alloc.allocatedOrders);
      existing.pickupPay += riderPickup * share;
      existing.dropoffPay += riderDropoff * share;
      existing.payment += riderPayment * share;

      // Carriage fields
      if (isCarriage) {
        existing.actualCompletedDeliveries = (existing.actualCompletedDeliveries || 0) + (riderActualOrders * share);
        existing.evaluatedHours = (existing.evaluatedHours || 0) + (riderEvaluatedHours * share);
        existing.achievementPayment = (existing.achievementPayment || 0) + (riderAchievement * share);
        existing.operatorDeduction = (existing.operatorDeduction || 0) + (riderOperatorDeduction * share);
        existing.netCost = (existing.netCost || 0) + (riderNetCost * share);
        existing.hasOperatorDeduction = existing.hasOperatorDeduction || hasOperatorDed;
      }

      if (alloc.notes) existing.notes.push(alloc.notes);
      driverAllocs.set(alloc.driverId, existing);
    }
  }

  // Find or create monthly report
  if (!imp.contractId) {
    return NextResponse.json({
      success: false,
      error: "يجب ربط التقرير بعقد قبل الترحيل. / Contract must be set before posting.",
    }, { status: 400 });
  }

  const existingReport = await prisma.deliveryMonthlyReport.findFirst({
    where: { contractId: imp.contractId, companyId: imp.companyId, month: imp.month, year: imp.year },
    include: { lines: { select: { id: true, driverId: true, talabatImportId: true } } },
  });

  if (existingReport?.lines.some((l) => l.talabatImportId)) {
    if (!forceReplace) {
      return NextResponse.json({
        success: false,
        error: "يوجد تقرير طلبات مرحّل بالفعل لهذا الشهر. هل تريد الاستبدال؟ / A Talabat import is already posted for this month. Replace?",
        needsConfirmation: true,
      }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    let reportId: string;

    if (!existingReport) {
      const totalOrders = Array.from(driverAllocs.values()).reduce((s, a) => s + a.orders, 0);
      const report = await tx.deliveryMonthlyReport.create({
        data: {
          contractId: imp.contractId!,
          companyId: imp.companyId,
          month: imp.month,
          year: imp.year,
          reportDate: new Date(),
          totalOrdersCount: Math.round(totalOrders),
          totalGrossAmount: 0,
          totalWalletDeducted: 0,
          netPayment: 0,
          status: "DRAFT",
        },
      });
      reportId = report.id;
    } else {
      reportId = existingReport.id;
      // Remove old Talabat lines
      await tx.deliveryMonthlyReportLine.deleteMany({
        where: { reportId, talabatImportId: { not: null } },
      });
    }

    // Create/update report lines
    for (const [driverId, alloc] of driverAllocs.entries()) {
      const existing = existingReport?.lines.find(
        (l) => l.driverId === driverId && !l.talabatImportId
      );

      // Build common data (both old and new format)
      const commonData: any = {
        ordersCount: Math.round(alloc.orders),
        talabatCalculatedOrders: alloc.orders,
        talabatPickupPay: alloc.pickupPay,
        talabatDropoffPay: alloc.dropoffPay,
        talabatTotalPayment: alloc.payment,
        talabatImportId: importId,
        talabatAllocationNotes: alloc.notes.join("; ") || null,
      };

      // Add Carriage-specific fields if present
      if (alloc.actualCompletedDeliveries !== undefined && alloc.actualCompletedDeliveries > 0) {
        commonData.actualCompletedDeliveries = Math.round(alloc.actualCompletedDeliveries);
        commonData.evaluatedHours = alloc.evaluatedHours || 0;
        commonData.achievementPayment = alloc.achievementPayment || 0;
        commonData.operatorDeduction = alloc.operatorDeduction || 0;
        commonData.netCost = alloc.netCost || 0;
        commonData.hasOperatorDeduction = alloc.hasOperatorDeduction || false;

        // Add warning note if operator deduction exists
        if (alloc.hasOperatorDeduction) {
          const opWarning = `تحذير: Operator Deduction = ${(alloc.operatorDeduction || 0).toFixed(3)} د.ك - قد يكون الحساب مستخدم من سائق آخر`;
          commonData.operatorDeductionNotes = opWarning;
        }
      }

      if (existing) {
        await tx.deliveryMonthlyReportLine.update({
          where: { id: existing.id },
          data: commonData,
        });
      } else {
        await tx.deliveryMonthlyReportLine.create({
          data: {
            reportId,
            driverId,
            ratePerOrder: 0,
            grossAmount: 0,
            walletDeducted: 0,
            netAmount: 0,
            ...commonData,
          },
        });
      }
    }

    // Update report totals
    const totalOrders = Array.from(driverAllocs.values()).reduce((s, a) => s + a.orders, 0);
    await tx.deliveryMonthlyReport.update({
      where: { id: reportId },
      data: { totalOrdersCount: Math.round(totalOrders) },
    });

    // Mark import as posted
    await tx.talabatReportImport.update({
      where: { id: importId },
      data: { status: "POSTED", postedAt: new Date() },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: session.id,
        companyId: imp.companyId,
        action: "POST_TALABAT_IMPORT",
        module: "delivery",
        resourceId: importId,
        resourceType: "TalabatReportImport",
        newValues: { reportId, month: imp.month, year: imp.year },
        ipAddress: request.headers.get("x-forwarded-for") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });
  });

  return NextResponse.json({ success: true });
}
