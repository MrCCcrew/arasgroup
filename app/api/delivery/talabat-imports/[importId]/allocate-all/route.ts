import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ importId: string }> }

/**
 * توزيع جماعي بضغطة واحدة: لكل سائق مطابَق تلقائياً (MATCHED) ولم توزَّع طلباته بعد،
 * يُنشئ توزيعاً واحداً بكامل طلباته المحسوبة لصالح السائق المطابق له.
 * يتجاوز السائقين أصحاب الكود المشترك (SHARED_ID_NEEDS_ALLOCATION) وغير المطابقين
 * (UNMATCHED) لأنهم يحتاجون توزيعاً يدوياً، ولا يلمس من سبق توزيعه.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId },
    select: {
      companyId: true,
      status: true,
      riders: {
        select: {
          id: true,
          matchingStatus: true,
          matchedDriverId: true,
          calculatedOrdersRounded: true,
          allocations: { select: { id: true } },
        },
      },
    },
  });
  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  if (imp.status === "POSTED" || imp.status === "CANCELLED") {
    return NextResponse.json({ success: false, error: "لا يمكن تعديل التوزيع بعد الترحيل أو الإلغاء" }, { status: 400 });
  }

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  // السائقون المؤهَّلون للتوزيع التلقائي: مطابَقون، لهم سائق، ولم توزَّع طلباتهم
  const eligible = imp.riders.filter(
    (r) => r.matchingStatus === "MATCHED" && r.matchedDriverId && r.allocations.length === 0,
  );

  const skipped = imp.riders.filter(
    (r) => r.matchingStatus === "SHARED_ID_NEEDS_ALLOCATION" || r.matchingStatus === "UNMATCHED",
  ).length;

  if (eligible.length === 0) {
    return NextResponse.json({
      success: true,
      allocated: 0,
      skipped,
      message: skipped > 0
        ? "لا يوجد سائقون مطابَقون للتوزيع التلقائي. السائقون المتبقّون يحتاجون توزيعاً يدوياً."
        : "تم توزيع جميع السائقين المطابَقين بالفعل.",
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const rider of eligible) {
      await tx.talabatReportAllocation.create({
        data: {
          importRiderId: rider.id,
          driverId: rider.matchedDriverId!,
          allocationType: "AUTO_MATCH",
          allocatedOrders: rider.calculatedOrdersRounded,
          createdById: session.id,
        },
      });
      await tx.talabatReportImportRider.update({
        where: { id: rider.id },
        data: { matchingStatus: "MANUALLY_ALLOCATED" },
      });
    }
  });

  return NextResponse.json({ success: true, allocated: eligible.length, skipped });
}
