import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

const companyAccessSchema = z.object({
  companyId: z.string(),
  roleId: z.string().optional(),
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

const createUserSchema = z.object({
  email: z.string().email("البريد الإلكتروني غير صالح"),
  nameAr: z.string().min(2, "الاسم العربي مطلوب"),
  nameEn: z.string().optional(),
  phone: z.string().optional(),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
  isActive: z.boolean().default(true),
  isSuperAdmin: z.boolean().default(false),
  roleIds: z.array(z.string()).default([]),
  groupIds: z.array(z.string()).default([]),
  companyAccess: z.array(companyAccessSchema).default([]),
  branchAccess: z.array(branchAccessSchema).default([]),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { nameAr: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : undefined,
    include: {
      roles: { include: { role: true, company: true } },
      groupAccess: { include: { group: true } },
      companyAccess: { include: { company: true, role: true } },
      branchAccess: { include: { branch: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: users });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const passwordHash = await hash(data.password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          nameAr: data.nameAr,
          nameEn: data.nameEn,
          phone: data.phone,
          passwordHash,
          isActive: data.isActive,
          isSuperAdmin: data.isSuperAdmin,
        },
      });

      if (data.roleIds.length) {
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({
            userId: user.id,
            roleId,
          })),
          skipDuplicates: true,
        });
      }

      for (const groupId of data.groupIds) {
        await tx.userGroupAccess.upsert({
          where: { userId_groupId: { userId: user.id, groupId } },
          update: {},
          create: { userId: user.id, groupId, canView: true },
        });
      }

      for (const entry of data.companyAccess) {
        await tx.userCompanyAccess.create({
          data: {
            userId: user.id,
            companyId: entry.companyId,
            roleId: entry.roleId,
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
            userId: user.id,
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
          action: "CREATE_USER_ACCESS",
          module: "users",
          resourceId: user.id,
          resourceType: "User",
          newValues: {
            roleIds: data.roleIds,
            groupIds: data.groupIds,
            companyAccess: data.companyAccess,
            branchAccess: data.branchAccess,
          },
          ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
          userAgent: request.headers.get("user-agent") ?? "",
        },
      });

      return user;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إنشاء المستخدم";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
