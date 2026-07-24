import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

function canViewTracking(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, companyId: string, companyType: string) {
  const module = companyType === "CAR_WASH" ? "CAR_WASH_OPERATIONS" : "DELIVERY_OPERATIONS";
  return hasPermission(session, module, "VIEW", { companyId });
}

export async function GET(_: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await props.params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { type: true } });
  if (!company || (company.type !== "DELIVERY" && company.type !== "CAR_WASH")) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (!canViewTracking(session, companyId, company.type)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await prisma.driverTrackingSession.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include: {
      user: { select: { nameAr: true, nameEn: true, accountType: true } },
      locationPoints: { orderBy: { recordedAt: "desc" }, take: 1, select: { latitude: true, longitude: true, recordedAt: true, receivedAt: true } },
      _count: { select: { locationPoints: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: sessions.map((trackingSession) => {
      const lastPoint = trackingSession.locationPoints[0] ?? null;
      return {
        id: trackingSession.id,
        status: trackingSession.status,
        startedAt: trackingSession.startedAt,
        endedAt: trackingSession.endedAt,
        driver: {
          nameAr: trackingSession.user.nameAr,
          nameEn: trackingSession.user.nameEn,
          accountType: trackingSession.user.accountType,
        },
        pointCount: trackingSession._count.locationPoints,
        lastLocation: lastPoint && {
          latitude: Number(lastPoint.latitude),
          longitude: Number(lastPoint.longitude),
          recordedAt: lastPoint.recordedAt,
          receivedAt: lastPoint.receivedAt,
        },
      };
    }),
  });
}
