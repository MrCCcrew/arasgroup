import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, props: { params: Promise<{ companyId: string; driverId: string }> }) {
  const actor = await getSession();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, driverId } = await props.params;
  if (!hasPermission(actor, "DRIVER_TRACKING", "DELETE", { companyId })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { confirmation?: unknown };
  if (body.confirmation !== "DELETE") return NextResponse.json({ error: "Confirmation is required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const driver = await tx.user.findFirst({ where: { id: driverId, employee: { is: { companyId, deletedAt: null } } }, select: { id: true, employeeId: true } });
    if (!driver) return { error: "NOT_FOUND" as const };
    const sessions = await tx.driverTrackingSession.findMany({ where: { companyId, userId: driver.id }, select: { id: true, status: true } });
    if (sessions.some((item) => item.status === "ACTIVE")) return { error: "ACTIVE" as const };
    const sessionIds = sessions.map((item) => item.id);
    const pointCount = sessionIds.length ? await tx.driverLocationPoint.count({ where: { sessionId: { in: sessionIds } } }) : 0;
    if (sessionIds.length) {
      await tx.driverLocationPoint.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await tx.driverTrackingSession.deleteMany({ where: { id: { in: sessionIds } } });
    }
    await tx.auditLog.create({ data: { userId: actor.id, action: "DELETE_ALL", module: "DRIVER_TRACKING", resourceId: driver.id, resourceType: "DRIVER_TRACKING_SESSION", companyId, oldValues: { driverId: driver.id, employeeId: driver.employeeId, sessionIds, sessionCount: sessionIds.length, pointCount } } });
    return { deletedSessions: sessionIds.length, deletedPoints: pointCount };
  });
  if ("error" in result) return NextResponse.json({ error: result.error === "ACTIVE" ? "Active sessions cannot be deleted" : "Driver not found" }, { status: result.error === "ACTIVE" ? 409 : 404 });
  return NextResponse.json({ success: true, data: result });
}
