import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

/**
 * يرجّع إجمالي الطلبات المحسوبة لكل سائق في شهر/سنة معيّنين.
 * المصدر هو سطور التقرير الشهري (DeliveryMonthlyReportLine) المُرحّلة من تقارير
 * الطلبات — وهي تعكس التوزيع النهائي على السائقين البدلاء (الطلبات تُحسب للسائق
 * البديل الذي عمل فعلياً وليس الأصلي).
 *
 * الاستجابة: { success, data: { [driverId]: ordersCount } }
 */
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const month = Number(searchParams.get("month"));
    const year = Number(searchParams.get("year"));

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    if (!month || month < 1 || month > 12) return NextResponse.json({ success: false, error: "الشهر غير صحيح" }, { status: 400 });
    if (!year) return NextResponse.json({ success: false, error: "السنة غير صحيحة" }, { status: 400 });

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const reports = await prisma.deliveryMonthlyReport.findMany({
      where: { companyId, month, year },
      select: { lines: { select: { driverId: true, ordersCount: true } } },
    });

    const totals: Record<string, number> = {};
    for (const report of reports) {
      for (const line of report.lines) {
        totals[line.driverId] = (totals[line.driverId] ?? 0) + line.ordersCount;
      }
    }

    // حل احتياطي: لو لا يوجد تقرير شهري مرحّل لهذا الشهر، نأخذ الطلبات الموزّعة
    // من تقارير الطلبات المستوردة (Talabat) مباشرةً — وهي تعكس التوزيع على
    // السائقين البدلاء، فتظهر الطلبات بمجرد التوزيع حتى قبل ترحيل التقرير.
    if (Object.keys(totals).length === 0) {
      const imports = await prisma.talabatReportImport.findMany({
        where: { companyId, month, year, status: { not: "CANCELLED" } },
        select: { riders: { select: { allocations: { select: { driverId: true, allocatedOrders: true } } } } },
      });
      for (const imp of imports) {
        for (const rider of imp.riders) {
          for (const alloc of rider.allocations) {
            totals[alloc.driverId] = (totals[alloc.driverId] ?? 0) + Math.round(Number(alloc.allocatedOrders));
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: totals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب طلبات السائقين" }, { status: 500 });
  }
}
