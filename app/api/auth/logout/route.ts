import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      await prisma.auditLog.create({
        data: {
          userId: session.id,
          action: "LOGOUT",
          module: "auth",
          resourceId: session.id,
          resourceType: "User",
        },
      });
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
