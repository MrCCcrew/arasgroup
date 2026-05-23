import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { kuwaitNow } from "@/lib/utils";

interface Props {
  params: Promise<{ notificationId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { notificationId } = await params;
  const body = await request.json();
  const status = body?.status;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    return NextResponse.json({ success: false, error: "Notification not found" }, { status: 404 });
  }

  if (!session.isSuperAdmin) {
    const allowed = notification.targetUserId === session.id ||
      (notification.companyId ? session.companyAccess.includes(notification.companyId) : false) ||
      (notification.targetRole ? session.roles.some((role) => role.name === notification.targetRole) : false);
    if (!allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      ...(status === "READ" ? { status: "READ", readAt: kuwaitNow() } : {}),
      ...(status === "RESOLVED" ? { status: "RESOLVED", resolvedAt: kuwaitNow() } : {}),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
