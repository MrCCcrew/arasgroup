import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 12;

function onlineStatus(lastUpdate: Date | null, hasSession: boolean) {
  if (!hasSession) return "NOT_STARTED" as const;
  if (lastUpdate && Date.now() - lastUpdate.getTime() <= 90_000) return "ONLINE" as const;
  return "OFFLINE" as const;
}

export async function GET(request: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await props.params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { type: true } });
  if (!company || (company.type !== "DELIVERY" && company.type !== "CAR_WASH")) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!hasPermission(session, "DRIVER_TRACKING", "VIEW", { companyId })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const status = searchParams.get("status") ?? "ALL";
  const accountType = searchParams.get("accountType") ?? "ALL";
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // These are fixed-count aggregate queries. No location-point collection is returned to the overview.
  const [drivers, sessionTotals, activeSessions, latestSessions, pointTotals, latestLocations] = await Promise.all([
    prisma.user.findMany({
      where: { accountType: { in: ["DRIVER", "CAR_WASH_WORKER"] }, employee: { is: { companyId, deletedAt: null } } },
      select: { id: true, employeeId: true, nameAr: true, nameEn: true, accountType: true, isActive: true },
    }),
    prisma.driverTrackingSession.groupBy({ where: { companyId }, by: ["userId", "employeeId"], _count: { id: true }, _max: { startedAt: true } }),
    prisma.driverTrackingSession.findMany({ where: { companyId, status: "ACTIVE" }, select: { id: true, userId: true, startedAt: true } }),
    prisma.driverTrackingSession.findMany({ where: { companyId }, distinct: ["userId"], orderBy: { startedAt: "desc" }, select: { id: true, userId: true, status: true, startedAt: true, endedAt: true } }),
    prisma.driverLocationPoint.groupBy({ where: { companyId }, by: ["employeeId"], _count: { id: true } }),
    prisma.driverLocationPoint.findMany({ where: { companyId }, distinct: ["employeeId"], orderBy: { recordedAt: "desc" }, select: { employeeId: true, latitude: true, longitude: true, recordedAt: true, receivedAt: true } }),
  ]);

  const sessionsByUser = new Map(sessionTotals.map((item) => [item.userId, item]));
  const activeByUser = new Map(activeSessions.map((item) => [item.userId, item]));
  const latestByUser = new Map(latestSessions.map((item) => [item.userId, item]));
  const pointsByEmployee = new Map(pointTotals.map((item) => [item.employeeId, item._count.id]));
  const locationByEmployee = new Map(latestLocations.map((item) => [item.employeeId, item]));

  const data = drivers.map((driver) => {
    const summary = sessionsByUser.get(driver.id);
    const latest = latestByUser.get(driver.id) ?? null;
    const location = driver.employeeId ? locationByEmployee.get(driver.employeeId) ?? null : null;
    const latestLocationAt = location?.recordedAt ?? null;
    return {
      driverId: driver.id,
      employeeId: driver.employeeId,
      driverName: { ar: driver.nameAr, en: driver.nameEn },
      accountType: driver.accountType,
      accountActive: driver.isActive,
      activeSession: activeByUser.get(driver.id) ?? null,
      latestSession: latest,
      latestLocation: location && { latitude: Number(location.latitude), longitude: Number(location.longitude) },
      latestLocationAt,
      totalSessions: summary?._count.id ?? 0,
      totalPoints: driver.employeeId ? pointsByEmployee.get(driver.employeeId) ?? 0 : 0,
      onlineStatus: onlineStatus(location?.receivedAt ?? null, Boolean(summary)),
    };
  }).filter((driver) => {
    const name = `${driver.driverName.ar} ${driver.driverName.en ?? ""}`.toLowerCase();
    return (!search || name.includes(search)) && (status === "ALL" || driver.onlineStatus === status) && (accountType === "ALL" || driver.accountType === accountType);
  }).sort((a, b) => {
    const priority = { ONLINE: 0, OFFLINE: 1, NOT_STARTED: 2 } as const;
    const priorityDiff = priority[a.onlineStatus] - priority[b.onlineStatus];
    if (priorityDiff !== 0) return priorityDiff;
    return (b.latestLocationAt?.getTime() ?? b.latestSession?.startedAt.getTime() ?? 0) - (a.latestLocationAt?.getTime() ?? a.latestSession?.startedAt.getTime() ?? 0);
  });

  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return NextResponse.json({ success: true, data: data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), pagination: { page: Math.min(page, totalPages), totalPages, total, pageSize: PAGE_SIZE } });
}
