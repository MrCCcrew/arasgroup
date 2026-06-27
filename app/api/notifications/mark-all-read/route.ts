import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { kuwaitNow } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  await prisma.notification.updateMany({
    where: session.isSuperAdmin
      ? { status: "UNREAD" }
      : {
          status: "UNREAD",
          OR: [
            { targetUserId: session.id },
            { targetRole: { in: session.roles.map((role) => role.name) } },
            { companyId: { in: session.companyAccess } },
          ],
        },
    data: {
      status: "READ",
      readAt: kuwaitNow(),
    },
  });

  return NextResponse.json({ success: true });
}
