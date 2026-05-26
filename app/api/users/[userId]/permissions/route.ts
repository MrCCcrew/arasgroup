import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";

const updatePermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      permissionId: z.string(),
      companyId: z.string().nullable().optional(),
      branchId: z.string().nullable().optional(),
      scopeKey: z.string(),
      isAllowed: z.boolean().default(true),
    }),
  ),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const body = await request.json();
    const parsed = updatePermissionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? "بيانات الصلاحيات غير صالحة" },
        { status: 400 },
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });

      if (parsed.data.permissions.length > 0) {
        await tx.userPermission.createMany({
          data: parsed.data.permissions.map((entry) => ({
            userId,
            permissionId: entry.permissionId,
            companyId: entry.companyId || null,
            branchId: entry.branchId || null,
            scopeKey: entry.scopeKey,
            isAllowed: entry.isAllowed,
            grantedById: session.id,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "UPDATE_USER_PERMISSIONS",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          newValues: {
            permissionsCount: parsed.data.permissions.length,
            permissions: parsed.data.permissions,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث الصلاحيات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
