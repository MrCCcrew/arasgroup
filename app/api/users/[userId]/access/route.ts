import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isOwnerOrAdminSession, requireRequestSession } from "@/lib/auth/access";

const companyAccessSchema = z.object({
  companyId: z.string(),
  canView: z.boolean().default(true),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canApprove: z.boolean().default(false),
});

const branchAccessSchema = z.object({
  branchId: z.string(),
  companyId: z.string(),
  canView: z.boolean().default(true),
  canCreate: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canApprove: z.boolean().default(false),
});

const updateAccessSchema = z.object({
  companyAccess: z.array(companyAccessSchema).default([]),
  branchAccess: z.array(branchAccessSchema).default([]),
});

/**
 * تحديث الشركات والفروع المصرّح بها لمستخدم قائم. يستبدل الصلاحيات الحالية
 * بالكامل بما يُرسَل (استبدال كلّي، وليس دمجًا) ضمن معاملة واحدة.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  if (!isOwnerOrAdminSession(session)) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const parsed = updateAccessSchema.safeParse(await request.json());
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
        { success: false, error: "مدير النظام لديه صلاحية على كل الشركات ولا يحتاج تحديدًا" },
        { status: 400 },
      );
    }

    // الفروع يجب أن تنتمي لشركة مصرّح بها
    const allowedCompanyIds = new Set(data.companyAccess.map((c) => c.companyId));
    for (const branch of data.branchAccess) {
      if (!allowedCompanyIds.has(branch.companyId)) {
        return NextResponse.json(
          { success: false, error: "لا يمكن منح صلاحية فرع لشركة غير مصرّح بها" },
          { status: 400 },
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      const [oldCompanyAccess, oldBranchAccess] = await Promise.all([
        tx.userCompanyAccess.findMany({ where: { userId }, select: { companyId: true } }),
        tx.userBranchAccess.findMany({ where: { userId }, select: { branchId: true } }),
      ]);

      // استبدال كلّي: نحذف القديم ونعيد إنشاء المُرسَل
      await tx.userCompanyAccess.deleteMany({ where: { userId } });
      await tx.userBranchAccess.deleteMany({ where: { userId } });

      for (const entry of data.companyAccess) {
        await tx.userCompanyAccess.create({
          data: {
            userId,
            companyId: entry.companyId,
            canView: entry.canView,
            canCreate: entry.canCreate,
            canUpdate: entry.canUpdate,
            canDelete: entry.canDelete,
            canApprove: entry.canApprove,
          },
        });
      }

      for (const entry of data.branchAccess) {
        await tx.userBranchAccess.create({
          data: {
            userId,
            branchId: entry.branchId,
            companyId: entry.companyId,
            canView: entry.canView,
            canCreate: entry.canCreate,
            canUpdate: entry.canUpdate,
            canDelete: entry.canDelete,
            canApprove: entry.canApprove,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "UPDATE_USER_ACCESS",
          module: "users",
          resourceId: userId,
          resourceType: "User",
          oldValues: {
            companyAccess: oldCompanyAccess.map((c) => c.companyId),
            branchAccess: oldBranchAccess.map((b) => b.branchId),
          },
          newValues: {
            companyAccess: data.companyAccess,
            branchAccess: data.branchAccess,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث صلاحيات الشركات";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
