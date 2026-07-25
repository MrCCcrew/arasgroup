import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export async function DELETE(_: Request, props: { params: Promise<{ companyId: string; sessionId: string }> }) {
  const actor = await getSession();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId, sessionId } = await props.params;
  if (!hasPermission(actor, "DRIVER_TRACKING", "DELETE", { companyId })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const trackingSession = await tx.driverTrackingSession.findFirst({ where: { id: sessionId, companyId }, select: { id: true, userId: true, employeeId: true, status: true } });
      if (!trackingSession) return { error: "NOT_FOUND" as const };
      if (trackingSession.status === "ACTIVE") return { error: "ACTIVE" as const };
      const pointCount = await tx.driverLocationPoint.count({ where: { sessionId } });
      await tx.driverLocationPoint.deleteMany({ where: { sessionId } });
      await tx.driverTrackingSession.delete({ where: { id: sessionId } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "DELETE", module: "DRIVER_TRACKING", resourceId: sessionId, resourceType: "DRIVER_TRACKING_SESSION", companyId, oldValues: { driverId: trackingSession.userId, employeeId: trackingSession.employeeId, sessionIds: [sessionId], sessionCount: 1, pointCount } } });
      return { pointCount };
    });
    if ("error" in result) return NextResponse.json({ error: result.error === "ACTIVE" ? "Active sessions cannot be deleted" : "Session not found" }, { status: result.error === "ACTIVE" ? 409 : 404 });
    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json({ error: "Unable to delete tracking session" }, { status: 500 });
  }
}
