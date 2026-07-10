import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const err = assertCompanyAccess(session, companyId);
  if (err) return err;

  try {
    const imports = await (prisma as any).talabatReportImport.findMany({
      where: { companyId },
      include: {
        contract: { select: { nameAr: true } },
        createdBy: { select: { nameAr: true } },
        _count: { select: { riders: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ success: true, data: imports });
  } catch {
    return NextResponse.json({ success: true, data: [] });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  // Step 1: Check DB migration FIRST before any new-table queries
  const dbReady = await checkDbMigrated();
  if (!dbReady) {
    return NextResponse.json({
      success: false,
      errors: [
        "قاعدة البيانات لم يتم تحديثها بعد. يرجى تشغيل 'npx prisma db push' على السيرفر أولاً.",
        "Database not migrated yet. Please run 'npx prisma db push' on the server first.",
      ],
    }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;
    const contractId = formData.get("contractId") as string | null;
    const month = parseInt(formData.get("month") as string ?? "0", 10);
    const year = parseInt(formData.get("year") as string ?? "0", 10);
    const orderRoundingMode = (formData.get("orderRoundingMode") as string) || "DECIMAL_2";

    if (!file || !companyId || !month || !year) {
      return NextResponse.json({ success: false, errors: ["الحقول المطلوبة: file, companyId, month, year"] }, { status: 400 });
    }
    const lowerFileName = file.name.toLowerCase();
    if (!lowerFileName.endsWith(".xlsx") && !lowerFileName.endsWith(".csv")) {
      return NextResponse.json({
        success: false,
        errors: [
          "صيغة الملف غير مقبولة. يُسمح فقط بملفات .xlsx أو .csv",
          "Only .xlsx or .csv files are accepted.",
        ],
      }, { status: 400 });
    }

    const companyErr = assertCompanyAccess(session, companyId);
    if (companyErr) return companyErr;

    // Step 2: Parse file — auto-detect format (Talabat Excel vs Carriage CSV)
    const buffer = Buffer.from(await file.arrayBuffer());
    const { parseDeliveryReport, applyRounding } = await import("@/lib/excel/talabat-parser");
    const parsed = await parseDeliveryReport(buffer, file.name);

    if (parsed.errors && parsed.errors.length > 0 && parsed.riders.length === 0) {
      return NextResponse.json({ success: false, errors: parsed.errors }, { status: 422 });
    }

    // Detect report type
    const isCarriageCSV = "reportType" in parsed && parsed.reportType === "CARRIAGE_CSV";

    // Step 3: Auto-match — use try/catch for each new table
    const allRiderIds = parsed.riders.map((r) => r.riderId);
    const idMap = new Map<string, string[]>();

    // Try DriverPlatformIdentifier table
    try {
      const identifiers = await (prisma as any).driverPlatformIdentifier.findMany({
        where: { platform: "TALABAT", isActive: true, platformDriverId: { in: allRiderIds } },
        include: { driver: { select: { id: true } } },
      });
      for (const ident of identifiers) {
        const list = idMap.get(ident.platformDriverId) ?? [];
        list.push(ident.driver.id);
        idMap.set(ident.platformDriverId, list);
      }
    } catch {
      // Table not yet migrated — skip
    }

    // Fallback: Driver.talabatId field
    try {
      const drivers = await prisma.driver.findMany({
        where: { employee: { companyId }, talabatId: { in: allRiderIds } },
        select: { id: true, talabatId: true },
      });
      for (const d of drivers) {
        if (d.talabatId && !idMap.has(d.talabatId)) {
          idMap.set(d.talabatId, [d.id]);
        }
      }
    } catch {
      // Skip fallback on error
    }

    // Step 4: Save import record
    let totalPickup = 0;
    let totalDropoff = 0;
    let totalCalc = 0;
    let totalPayment = 0;

    if (isCarriageCSV) {
      // Carriage CSV totals
      const carriageParsed = parsed as any;
      totalPickup = carriageParsed.totals.pickupPayment;
      totalDropoff = carriageParsed.totals.dropoffPayment;
      totalCalc = carriageParsed.totals.completedDeliveries; // Actual deliveries, not calculated
      totalPayment = carriageParsed.totals.netPayment;
    } else {
      // Talabat Excel totals (old logic)
      totalPickup = parsed.riders.reduce((s: number, r: any) => s + r.totalPickupPay, 0);
      totalDropoff = parsed.riders.reduce((s: number, r: any) => s + r.totalDropoffPay, 0);
      totalCalc = parsed.riders.reduce((s: number, r: any) => s + r.calculatedOrdersRaw, 0);
      totalPayment = parsed.riders.reduce((s: number, r: any) => s + r.totalPayment, 0);
    }

    // Build riders data based on report type
    const ridersData = parsed.riders.map((r: any) => {
      const matchedIds = idMap.get(r.riderId) ?? [];
      const matchingStatus =
        matchedIds.length === 0 ? "UNMATCHED"
        : matchedIds.length === 1 ? "MATCHED"
        : "SHARED_ID_NEEDS_ALLOCATION";
      const matchedDriverId = matchedIds.length === 1 ? matchedIds[0] : undefined;

      if (isCarriageCSV) {
        // Carriage CSV format
        return {
          talabatRiderId: r.riderId,
          talabatRiderName: r.riderName,
          reportType: "CARRIAGE_CSV",
          legalName: r.legalName || undefined,
          vehicle: r.vehicle || undefined,
          contractName: undefined,
          companyCode: undefined,
          rowCount: 1,

          // Productivity
          evaluatedHours: r.evaluatedHours,
          actualCompletedDeliveries: r.totalCompletedDeliveries,
          pickupsCount: r.pickupsCount,
          pickupCancellations: r.pickupCancellations,
          dropoffsCount: r.dropoffsCount,
          dropoffCancellations: r.dropoffCancellations,

          // Payments (map to old fields for compatibility)
          totalPickupPay: r.pickupPayment,
          totalDropoffPay: r.dropoffPayment,
          calculatedOrdersRaw: r.totalCompletedDeliveries, // Calculated: (Pickup + Dropoff) / 1.050
          calculatedOrdersRounded: r.totalCompletedDeliveries,
          totalPayment: r.netPayment,
          totalDeductions: r.operatorDeduction,

          // Carriage-specific fields
          achievementPayment: r.achievementPayment,
          operatorDeduction: r.operatorDeduction,
          hasOperatorDeduction: r.operatorDeduction !== 0,
          riderIncentives: r.riderIncentives,
          riderCompensation: r.riderCompensation,
          riderDeduction: r.riderDeduction,
          riderPositiveAdjustment: r.riderPositiveAdjustment,
          riderNegativeAdjustment: r.riderNegativeAdjustment,

          // 3PL
          thirdPartyIncentives: r.thirdPartyIncentives,
          thirdPartyDeductions: r.thirdPartyDeductions,
          thirdPartyPositiveAdjustments: r.thirdPartyPositiveAdjustments,
          thirdPartyNegativeAdjustments: r.thirdPartyNegativeAdjustments,

          netCost: r.netCost,

          // Fleet deductions (usually 0 for individual riders)
          codDeficit: r.codDeficit,
          clawbackDeduction: r.clawbackDeduction,
          clawbackRefund: r.clawbackRefund,
          inventoryDeduction: r.inventoryDeduction,
          inventoryClaim: r.inventoryClaim,
          thirdPartyOtherDeductions: r.thirdPartyOtherDeductions,
          contractFees: r.contractFees,

          netPayment: r.netPayment,

          // Downgraded fields (not applicable for Carriage)
          downgradedRowCount: 0,
          downgradedPickupPay: 0,
          downgradedDropoffPay: 0,
          downgradedCalculatedOrders: 0,
          downgradedTotalPayment: 0,

          matchingStatus,
          matchedDriverId,
        };
      } else {
        // Talabat Excel format (old logic)
        const rounded = applyRounding(r.calculatedOrdersRaw, orderRoundingMode);
        return {
          talabatRiderId: r.riderId,
          talabatRiderName: r.riderName,
          reportType: "TALABAT_EXCEL",
          contractName: r.contractName || undefined,
          companyCode: r.companyCode || undefined,
          rowCount: r.rowCount,
          totalPickupPay: r.totalPickupPay,
          totalDropoffPay: r.totalDropoffPay,
          calculatedOrdersRaw: r.calculatedOrdersRaw,
          calculatedOrdersRounded: rounded,
          totalPayment: r.totalPayment,
          totalDeductions: r.totalDeductions,
          downgradedRowCount: r.downgradedRowCount,
          downgradedPickupPay: r.downgradedPickupPay,
          downgradedDropoffPay: r.downgradedDropoffPay,
          downgradedCalculatedOrders: r.downgradedCalculatedOrders,
          downgradedTotalPayment: r.downgradedTotalPayment,
          matchingStatus,
          matchedDriverId,
        };
      }
    });

    // Build fleet items data (only for Carriage)
    const carriageParsed = parsed as any;
    const fleetItemsData = isCarriageCSV && carriageParsed.fleetRows ? carriageParsed.fleetRows.map((f: any) => ({
      type: f.type,
      description: f.description,
      legalName: f.description,
      codDeficit: f.codDeficit,
      inventoryDeduction: f.inventoryDeduction,
      contractFees: f.contractFees,
      thirdPartyOtherDeductions: f.thirdPartyOtherDeductions,
      clawbackDeduction: f.clawbackDeduction,
      clawbackRefund: f.clawbackRefund,
      netPayment: f.netPayment,
    })) : [];

    // Build suspense riders data (only for Carriage)
    const suspenseRidersData = isCarriageCSV && carriageParsed.suspenseRows ? carriageParsed.suspenseRows.map((s: any) => ({
      talabatRiderId: s.riderId || "UNKNOWN",
      talabatRiderName: s.riderName || "UNKNOWN",
      reportType: "CARRIAGE_CSV",
      rowCount: 1,
      totalPickupPay: 0,
      totalDropoffPay: 0,
      calculatedOrdersRaw: 0,
      calculatedOrdersRounded: 0,
      totalPayment: s.netPayment,
      totalDeductions: 0,
      netCost: s.netCost,
      netPayment: s.netPayment,
      codDeficit: s.codDeficit,
      inventoryDeduction: s.inventoryDeduction,
      contractFees: s.contractFees,
      isSuspenseItem: true,
      suspenseReason: s.reason,
      matchingStatus: "UNMATCHED",
      matchedDriverId: undefined,
    })) : [];

    const allRidersData = [...ridersData, ...suspenseRidersData];

    const importRecord = await (prisma as any).talabatReportImport.create({
      data: {
        companyId,
        contractId: contractId || undefined,
        month,
        year,
        fileName: file.name,
        status: "DRAFT",
        orderRoundingMode,
        totalRows: isCarriageCSV ? (parsed as any).totalDataRows : (parsed as any).totalRows,
        totalRiders: parsed.riders.length,
        totalPickupPay: totalPickup,
        totalDropoffPay: totalDropoff,
        totalCalculatedOrders: totalCalc,
        totalPayment,
        contractSummaryFinalPayment: isCarriageCSV ? undefined : ((parsed as any).contractSummary?.finalPayment ?? undefined),
        createdById: session.id,
        riders: {
          create: allRidersData,
        },
        ...(fleetItemsData.length > 0 ? {
          fleetItems: {
            create: fleetItemsData,
          },
        } : {}),
      },
      include: { riders: true, fleetItems: true },
    });

    // Step 5: Auto-create allocations for matched riders
    const matchedRiders = importRecord.riders.filter(
      (r: any) => r.matchingStatus === "MATCHED" && r.matchedDriverId && !r.isSuspenseItem
    );
    if (matchedRiders.length > 0) {
      await (prisma as any).talabatReportAllocation.createMany({
        data: matchedRiders.map((r: any) => ({
          importRiderId: r.id,
          driverId: r.matchedDriverId,
          allocationType: "AUTO_MATCH",
          allocatedOrders: isCarriageCSV ? (r.actualCompletedDeliveries || 0) : r.calculatedOrdersRounded,
          createdById: session.id,
        })),
      });
    }

    const parsedAny = parsed as any;
    const warnings = parsedAny.warnings && parsedAny.warnings.length > 0 ? parsedAny.warnings :
                     (parsedAny.errors && parsedAny.errors.length > 0 ? parsedAny.errors : undefined);
    return NextResponse.json({ success: true, data: importRecord, warnings }, { status: 201 });

  } catch (error) {
    console.error("[talabat-imports POST]", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      errors: [`فشل في معالجة الملف: ${msg}`],
    }, { status: 500 });
  }
}

async function checkDbMigrated(): Promise<boolean> {
  try {
    // Use raw SQL — works regardless of Prisma client version
    await prisma.$queryRaw`SELECT 1 FROM talabat_report_imports LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}
