import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest, props: { params: Promise<{ companyId: string; driverId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, driverId } = await props.params;
  if (!hasPermission(session, "DRIVER_TRACKING", "VIEW_HISTORY", { companyId })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const driver = await prisma.user.findFirst({
    where: { id: driverId, accountType: { in: ["DRIVER", "CAR_WASH_WORKER"] }, employee: { is: { companyId, deletedAt: null } } },
    select: { id: true, employeeId: true, nameAr: true, nameEn: true, accountType: true, isActive: true },
  });
  if (!driver?.employeeId) return NextResponse.json({ error: "Driver not found" }, { status: 404 });

  const [totalSessions, totalPoints, latestLocation, activeSession, sessions] = await Promise.all([
    prisma.driverTrackingSession.count({ where: { companyId, userId: driver.id } }),
    prisma.driverLocationPoint.count({ where: { companyId, employeeId: driver.employeeId } }),
    prisma.driverLocationPoint.findFirst({ where: { companyId, employeeId: driver.employeeId }, orderBy: { recordedAt: "desc" }, select: { latitude: true, longitude: true, recordedAt: true, receivedAt: true } }),
    prisma.driverTrackingSession.findFirst({ where: { companyId, userId: driver.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" }, select: { id: true, startedAt: true } }),
    prisma.driverTrackingSession.findMany({ where: { companyId, userId: driver.id }, orderBy: { startedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, status: true, startedAt: true, endedAt: true, _count: { select: { locationPoints: true } } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalSessions / PAGE_SIZE));
  return NextResponse.json({
    success: true,
    data: {
      driver: { id: driver.id, employeeId: driver.employeeId, nameAr: driver.nameAr, nameEn: driver.nameEn, accountType: driver.accountType, accountActive: driver.isActive },
      latestLocation: latestLocation && { latitude: Number(latestLocation.latitude), longitude: Number(latestLocation.longitude), recordedAt: latestLocation.recordedAt, receivedAt: latestLocation.receivedAt },
      activeSession,
      totalSessions,
      totalPoints,
      sessions: sessions.map((item) => ({ ...item, pointCount: item._count.locationPoints })),
    },
    pagination: { page: Math.min(page, totalPages), totalPages, total: totalSessions, pageSize: PAGE_SIZE },
  });
}
