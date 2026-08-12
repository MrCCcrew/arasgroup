import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/permissions";

const inputSchema = z.object({
  companyId: z.string().min(1),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const input = inputSchema.safeParse(await request.json());
    if (!input.success) return NextResponse.json({ success: false, error: input.error.errors[0]?.message ?? "بيانات غير صالحة" }, { status: 400 });
    if (!hasPermission(session, "DRIVER_ACCOUNTS", "RESET_PASSWORD", { companyId: input.data.companyId })) {
      return NextResponse.json({ success: false, error: "لا تملك صلاحية إعادة تعيين كلمة المرور" }, { status: 403 });
    }

    const { userId } = await params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { select: { companyId: true } } },
    });
    if (!user?.employee || user.employee.companyId !== input.data.companyId || !["DRIVER", "CAR_WASH_WORKER"].includes(user.accountType)) {
      return NextResponse.json({ success: false, error: "حساب السائق غير موجود في هذه الشركة" }, { status: 404 });
    }

    const passwordHash = await hash(input.data.password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true } }),
      prisma.auditLog.create({
        data: {
          userId: session.id,
          action: "RESET_DRIVER_PASSWORD",
          module: "DRIVER_ACCOUNTS",
          resourceId: userId,
          resourceType: "User",
          companyId: input.data.companyId,
          oldValues: { passwordHash: "hidden" },
          newValues: { passwordHash: "updated", mustChangePassword: true },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذرت إعادة تعيين كلمة المرور";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
