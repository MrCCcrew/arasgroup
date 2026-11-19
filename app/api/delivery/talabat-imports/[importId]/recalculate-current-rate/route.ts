import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { refreshDraftDeliverySalaryOrders } from "@/lib/hr/refresh-delivery-salary-orders";

interface Ctx { params: Promise<{ importId: string }> }

const COMPONENT_RATE = 0.59;
const FULL_ORDER_RATE = 1.18;

function round3(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function netCount(count: number | null, cancellations: number | null) {
  return Math.max(0, Number(count ?? 0) - Math.abs(Number(cancellations ?? 0)));
}

/**
 * Recalculates an existing unposted current-rate report without discarding its
 * allocation decisions. Each rider's existing allocation percentages are kept;
 * only their allocated order values are scaled to the new calculated total.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const report = await prisma.talabatReportImport.findUnique({
    where: { id: importId },
    include: {
      riders: {
        include: { allocations: { orderBy: { createdAt: "asc" } } },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  }
  const accessError = assertCompanyAccess(session, report.companyId);
  if (accessError) return accessError;
  if (report.status === "POSTED" || report.status === "CANCELLED") {
    return NextResponse.json({
      success: false,
      error: "لا يمكن إعادة احتساب تقرير مُرحّل أو مُلغى. أنشئ تقريرًا بديلًا للشهر أولًا.",
    }, { status: 400 });
  }

  const unsupported = report.riders.filter((rider) =>
    rider.pickupsCount === null || rider.pickupCancellations === null ||
    rider.dropoffsCount === null || rider.dropoffCancellations === null
  );
  if (unsupported.length > 0) {
    return NextResponse.json({
      success: false,
      error: "هذا التقرير لا يحتوي على عدادات Pickup وDropoff والإلغاءات اللازمة لإعادة الحساب.",
    }, { status: 422 });
  }

  const invalidAllocations = report.riders.find((rider) =>
    rider.allocations.length > 0 && rider.allocations.reduce(
      (sum, allocation) => sum + Number(allocation.allocatedOrders), 0
    ) <= 0
  );
  if (invalidAllocations) {
    return NextResponse.json({
      success: false,
      error: `لا يمكن حفظ توزيع السائق ${invalidAllocations.talabatRiderName} لأن إجمالي توزيعه الحالي صفر.`,
    }, { status: 422 });
  }

  await prisma.$transaction(async (tx) => {
    let totalPickupPay = 0;
    let totalDropoffPay = 0;
    let totalCalculatedOrders = 0;
    let totalPayment = 0;
    // Allocation is the authoritative assignment of calculated orders to the
    // actual driver who worked. Keep the per-driver total so draft payrolls
    // can be refreshed in this very same atomic transaction.
    const ordersByDriverId = new Map<string, number>();

    for (const rider of report.riders) {
      const billablePickups = netCount(rider.pickupsCount, rider.pickupCancellations);
      const billableDropoffs = netCount(rider.dropoffsCount, rider.dropoffCancellations);
      const pickupPay = round3(billablePickups * COMPONENT_RATE);
      const dropoffPay = round3(billableDropoffs * COMPONENT_RATE);
      const payment = round3(pickupPay + dropoffPay);
      const calculatedOrders = round3(payment / FULL_ORDER_RATE);

      totalPickupPay += pickupPay;
      totalDropoffPay += dropoffPay;
      totalCalculatedOrders += calculatedOrders;
      totalPayment += payment;

      await tx.talabatReportImportRider.update({
        where: { id: rider.id },
        data: {
          actualCompletedDeliveries: Math.round(billableDropoffs),
          totalPickupPay: pickupPay,
          totalDropoffPay: dropoffPay,
          calculatedOrdersRaw: calculatedOrders,
          calculatedOrdersRounded: calculatedOrders,
          totalPayment: payment,
        },
      });

      if (rider.allocations.length > 0) {
        const allocatedBefore = rider.allocations.reduce(
          (sum, allocation) => sum + Number(allocation.allocatedOrders), 0
        );
        let allocatedAfter = 0;
        for (const [index, allocation] of rider.allocations.entries()) {
          const isLast = index === rider.allocations.length - 1;
          const nextAmount = isLast
            ? round3(calculatedOrders - allocatedAfter)
            : round3(calculatedOrders * Number(allocation.allocatedOrders) / allocatedBefore);
          allocatedAfter += nextAmount;
          ordersByDriverId.set(
            allocation.driverId,
            round3((ordersByDriverId.get(allocation.driverId) ?? 0) + nextAmount),
          );
          await tx.talabatReportAllocation.update({
            where: { id: allocation.id },
            data: { allocatedOrders: nextAmount },
          });
        }
      }
    }

    await tx.talabatReportImport.update({
      where: { id: report.id },
      data: {
        totalPickupPay: round3(totalPickupPay),
        totalDropoffPay: round3(totalDropoffPay),
        totalCalculatedOrders: round3(totalCalculatedOrders),
        totalPayment: round3(totalPayment),
      },
    });

    const refreshedSalaryBatches = await refreshDraftDeliverySalaryOrders(tx, {
      companyId: report.companyId,
      month: report.month,
      year: report.year,
      userId: session.id,
      ordersByDriverId,
    });

    await tx.auditLog.create({
      data: {
        userId: session.id,
        companyId: report.companyId,
        action: "RECALCULATE_TALABAT_CURRENT_RATE",
        module: "delivery",
        resourceId: report.id,
        resourceType: "TalabatReportImport",
        newValues: {
          ratePerComponent: COMPONENT_RATE,
          fullOrderRate: FULL_ORDER_RATE,
          refreshedDraftSalaryBatches: refreshedSalaryBatches,
        },
        ipAddress: request.headers.get("x-forwarded-for") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });
  });

  return NextResponse.json({ success: true });
}
