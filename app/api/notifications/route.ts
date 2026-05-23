import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { regenerateNotifications } from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "20");
  const status = searchParams.get("status");
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where = {
    ...(session.isSuperAdmin ? {} : {
      OR: [
        { companyId: { in: session.companyAccess } },
        { targetUserId: session.id },
        { targetRole: { in: session.roles.map((role) => role.name) } },
      ],
    }),
    ...(status ? { status } : {}),
    ...(unreadOnly ? { status: "UNREAD" } : {}),
  };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      take: limit,
    }),
    prisma.notification.count({
      where: {
        ...where,
        status: "UNREAD",
      },
    }),
  ]);

  return NextResponse.json({ success: true, data: { items, unreadCount } });
}

export async function POST() {
  const summary = await regenerateNotifications();
  return NextResponse.json({ success: true, data: summary });
}
