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

  const imports = await prisma.talabatReportImport.findMany({
    where: { companyId },
    include: {
      contract: { select: { nameAr: true } },
      createdBy: { select: { nameAr: true } },
      _count: { select: { riders: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ success: true, data: imports });
}

export async function POST(request: NextRequest) {
  let session;
  try {
    const s = await requireRequestSession(request);
    if (s instanceof NextResponse) return s;
    session = s;
  } catch {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 401 });
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
      return NextResponse.json({ success: false, error: "الحقول المطلوبة: file, companyId, month, year" }, { status: 400 });
    }
    if (!file.name.endsWith(".xlsx")) {
      return NextResponse.json({
        success: false,
        error: "صيغة الملف غير مقبولة. يُسمح فقط بملفات .xlsx / Only .xlsx files are accepted.",
      }, { status: 400 });
    }

    const companyErr = assertCompanyAccess(session, companyId);
    if (companyErr) return companyErr;

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseTalabatExcel(buffer);

    if (parsed.errors.length > 0 && parsed.riders.length === 0) {
      return NextResponse.json({ success: false, errors: parsed.errors }, { status: 422 });
    }

    // Auto-match riders using DriverPlatformIdentifier
    const allRiderIds = parsed.riders.map((r) => r.riderId);
    const identifiers = await prisma.driverPlatformIdentifier.findMany({
      where: { platform: "TALABAT", isActive: true, platformDriverId: { in: allRiderIds } },
      include: { driver: { select: { id: true } } },
    });

    const idMap = new Map<string, string[]>(); // riderId → [driverId]
    for (const ident of identifiers) {
      const list = idMap.get(ident.platformDriverId) ?? [];
      list.push(ident.driver.id);
      idMap.set(ident.platformDriverId, list);
    }

    // Also check Driver.talabatId as fallback
    const drivers = await prisma.driver.findMany({
      where: { employee: { companyId }, talabatId: { in: allRiderIds } },
      select: { id: true, talabatId: true },
    });
    for (const d of drivers) {
      if (d.talabatId && !idMap.has(d.talabatId)) {
        idMap.set(d.talabatId, [d.id]);
      }
    }

    const totalPickup = parsed.riders.reduce((s, r) => s + r.totalPickupPay, 0);
    const totalDropoff = parsed.riders.reduce((s, r) => s + r.totalDropoffPay, 0);
    const totalCalc = parsed.riders.reduce((s, r) => s + r.calculatedOrdersRaw, 0);
    const totalPayment = parsed.riders.reduce((s, r) => s + r.totalPayment, 0);

    // Guard: check if DB table exists (migration not yet run)
    try {
      await (prisma.talabatReportImport as any).count({ take: 1 });
    } catch {
      return NextResponse.json({
        success: false,
        error: "قاعدة البيانات لم يتم تحديثها بعد. يرجى تشغيل 'prisma db push' على السيرفر أولاً. / Database not migrated yet. Please run 'prisma db push' on the server first.",
      }, { status: 503 });
    }

    const importRecord = await prisma.talabatReportImport.create({
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
              matchedIds.length === 0
                ? "UNMATCHED"
                : matchedIds.length === 1
                  ? "MATCHED"
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

    // Auto-create allocations for MATCHED riders
    const matchedRiders = importRecord.riders.filter(
      (r) => r.matchingStatus === "MATCHED" && r.matchedDriverId
    );
    if (matchedRiders.length > 0) {
      await prisma.talabatReportAllocation.createMany({
        data: matchedRiders.map((r) => ({
          importRiderId: r.id,
          driverId: r.matchedDriverId!,
          allocationType: "AUTO_MATCH",
          allocatedOrders: r.calculatedOrdersRounded,
          createdById: session.id,
        })),
      });
    }

    const warnings = parsed.errors.length > 0 ? parsed.errors : undefined;
    return NextResponse.json({ success: true, data: importRecord, warnings }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في معالجة الملف" }, { status: 500 });
  }
}
