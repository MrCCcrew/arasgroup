import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";

const roleAssignmentSchema = z.object({
  roleId: z.string(),
  companyId: z.string().nullable().optional(),
});

const updateRolesSchema = z.object({
  roles: z.array(roleAssignmentSchema),
});

/**
 * تحديث أدوار المستخدم. يستبدل جميع الأدوار الحالية بالأدوار المُرسَلة.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const parsed = updateRolesSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const data = parsed.data;

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true },
    });
    if (!existingUser) {
      return NextResponse.json({ success: false, error: "المستخدم غير موجود" }, { status: 404 });
    }
    if (existingUser.isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "مدير النظام لديه كل الصلاحيات ولا يحتاج أدوارًا محددة" },
        { status: 400 },
      );
    }

    // التحقق من صحة الأدوار والشركات
    const roleIds = new Set(data.roles.map((r) => r.roleId));
    const companyIds = new Set(data.roles.map((r) => r.companyId).filter((id): id is string => id !== null && id !== undefined));

    const [validRoles, validCompanies] = await Promise.all([
      prisma.role.findMany({ where: { id: { in: Array.from(roleIds) } }, select: { id: true } }),
      companyIds.size > 0
        ? prisma.company.findMany({ where: { id: { in: Array.from(companyIds) } }, select: { id: true } })
        : Promise.resolve([]),
    ]);

    if (validRoles.length !== roleIds.size) {
      return NextResponse.json({ success: false, error: "أحد الأدوار المحددة غير موجود" }, { status: 400 });
    }

    if (validCompanies.length !== companyIds.size) {
      return NextResponse.json({ success: false, error: "أحد الشركات المحددة غير موجودة" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      const oldRoles = await tx.userRole.findMany({
        where: { userId },
        select: { roleId: true, companyId: true },
      });

      // حذف الأدوار القديمة
      await tx.userRole.deleteMany({ where: { userId } });

      // إضافة الأدوار الجديدة
      if (data.roles.length > 0) {
        await tx.userRole.createMany({
          data: data.roles.map((r) => ({
            userId,
            roleId: r.roleId,
            companyId: r.companyId || null,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "UPDATE_USER_ROLES",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          oldValues: { roles: oldRoles },
          newValues: { roles: data.roles },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث الأدوار";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
