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

    return NextResponse.json({ success: true, data: totals });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب طلبات السائقين" }, { status: 500 });
  }
}
