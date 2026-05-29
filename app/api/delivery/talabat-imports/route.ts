import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { parseTalabatExcel, applyRounding } from "@/lib/excel/talabat-parser";

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
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({
        success: false,
        errors: [
          "صيغة الملف غير مقبولة. يُسمح فقط بملفات .xlsx",
          "Only .xlsx files are accepted.",
        ],
      }, { status: 400 });
    }

    const companyErr = assertCompanyAccess(session, companyId);
    if (companyErr) return companyErr;

    // Step 2: Parse Excel (no DB needed)
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseTalabatExcel(buffer);

    if (parsed.errors.length > 0 && parsed.riders.length === 0) {
      return NextResponse.json({ success: false, errors: parsed.errors }, { status: 422 });
    }

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
    const totalPickup  = parsed.riders.reduce((s, r) => s + r.totalPickupPay, 0);
    const totalDropoff = parsed.riders.reduce((s, r) => s + r.totalDropoffPay, 0);
    const totalCalc    = parsed.riders.reduce((s, r) => s + r.calculatedOrdersRaw, 0);
    const totalPayment = parsed.riders.reduce((s, r) => s + r.totalPayment, 0);

    const importRecord = await (prisma as any).talabatReportImport.create({
      data: {
        companyId,
        contractId: contractId || undefined,
        month,
        year,
        fileName: file.name,
        status: "DRAFT",
        orderRoundingMode,
        totalRows: parsed.totalRows,
        totalRiders: parsed.riders.length,
        totalPickupPay: totalPickup,
        totalDropoffPay: totalDropoff,
        totalCalculatedOrders: totalCalc,
        totalPayment,
        contractSummaryFinalPayment: parsed.contractSummary?.finalPayment ?? undefined,
        createdById: session.id,
        riders: {
          create: parsed.riders.map((r) => {
            const matchedIds = idMap.get(r.riderId) ?? [];
            const matchingStatus =
              matchedIds.length === 0 ? "UNMATCHED"
              : matchedIds.length === 1 ? "MATCHED"
              : "SHARED_ID_NEEDS_ALLOCATION";
            const matchedDriverId = matchedIds.length === 1 ? matchedIds[0] : undefined;
            const rounded = applyRounding(r.calculatedOrdersRaw, orderRoundingMode);
            return {
              talabatRiderId: r.riderId,
              talabatRiderName: r.riderName,
              contractName: r.contractName || undefined,
              companyCode: r.companyCode || undefined,
              rowCount: r.rowCount,
              totalPickupPay: r.totalPickupPay,
              totalDropoffPay: r.totalDropoffPay,
              calculatedOrdersRaw: r.calculatedOrdersRaw,
              calculatedOrdersRounded: rounded,
              totalPayment: r.totalPayment,
              totalDeductions: r.totalDeductions,
              matchingStatus,
              matchedDriverId,
            };
          }),
        },
      },
      include: { riders: true },
    });

    // Step 5: Auto-create allocations for matched riders
    const matchedRiders = importRecord.riders.filter(
      (r: any) => r.matchingStatus === "MATCHED" && r.matchedDriverId
    );
    if (matchedRiders.length > 0) {
      await (prisma as any).talabatReportAllocation.createMany({
        data: matchedRiders.map((r: any) => ({
          importRiderId: r.id,
          driverId: r.matchedDriverId,
          allocationType: "AUTO_MATCH",
          allocatedOrders: r.calculatedOrdersRounded,
          createdById: session.id,
        })),
      });
    }

    const warnings = parsed.errors.length > 0 ? parsed.errors : undefined;
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
    await (prisma as any).talabatReportImport.count();
    return true;
  } catch {
    return false;
  }
}
