import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";

const passwordSchema = z.object({
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "تغيير كلمة المرور متاح للأدمن أو الأونر فقط" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0]?.message ?? "بيانات كلمة المرور غير صالحة" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }

    const passwordHash = await hash(parsed.data.password, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "RESET_USER_PASSWORD",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          oldValues: { passwordHash: user.passwordHash ? "hidden" : null },
          newValues: { passwordHash: "updated" },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث كلمة المرور";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
