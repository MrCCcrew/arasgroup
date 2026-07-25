import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest, props: { params: Promise<{ companyId: string }> }) {
  const actor = await getSession();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { companyId } = await props.params;
  if (!hasPermission(actor, "DRIVER_TRACKING", "DELETE", { companyId })) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as { sessionIds?: unknown; confirmation?: unknown };
  const sessionIds = Array.isArray(body.sessionIds) ? [...new Set(body.sessionIds.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
  if (body.confirmation !== "DELETE" || sessionIds.length === 0 || sessionIds.length > 100) return NextResponse.json({ error: "Invalid deletion request" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const sessions = await tx.driverTrackingSession.findMany({ where: { companyId, id: { in: sessionIds } }, select: { id: true, userId: true, employeeId: true, status: true } });
    if (sessions.length !== sessionIds.length) return { error: "NOT_FOUND" as const };
    if (sessions.some((item) => item.status === "ACTIVE")) return { error: "ACTIVE" as const };
    const pointCount = await tx.driverLocationPoint.count({ where: { sessionId: { in: sessionIds } } });
    await tx.driverLocationPoint.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await tx.driverTrackingSession.deleteMany({ where: { id: { in: sessionIds } } });
    await tx.auditLog.create({ data: { userId: actor.id, action: "BULK_DELETE", module: "DRIVER_TRACKING", resourceId: companyId, resourceType: "DRIVER_TRACKING_SESSION", companyId, oldValues: { sessionIds, sessionCount: sessions.length, pointCount, driverIds: [...new Set(sessions.map((item) => item.userId))] } } });
    return { deletedSessions: sessions.length, deletedPoints: pointCount };
  });
  if ("error" in result) return NextResponse.json({ error: result.error === "ACTIVE" ? "Active sessions cannot be deleted" : "One or more sessions were not found" }, { status: result.error === "ACTIVE" ? 409 : 404 });
  return NextResponse.json({ success: true, data: result });
}
