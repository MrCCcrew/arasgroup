import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/permissions";

const inputSchema = z.object({
  nameAr: z.string().trim().min(2, "اكتب اسم الموظف"),
  nameEn: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email("اكتب بريداً إلكترونياً صحيحاً"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف"),
});

async function access(request: NextRequest, companyId: string) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId);
  if (companyError) return companyError;
  const canManage = hasPermission(session, "CONTRACTING", "UPDATE", { companyId }) || hasPermission(session, "ACCOUNTING", "UPDATE", { companyId });
  if (!canManage) return NextResponse.json({ success: false, error: "غير مصرح بإدارة حسابات موظفي الموقع" }, { status: 403 });
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "CONTRACTING", isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "هذه الخدمة متاحة لشركات المقاولات فقط" }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const users = await prisma.user.findMany({
    where: { roles: { some: { companyId, role: { name: "CONTRACTING_SITE_EMPLOYEE" } } } },
    select: { id: true, nameAr: true, nameEn: true, email: true, phone: true, isActive: true, createdAt: true, _count: { select: { uploadedAttachments: { where: { companyId, entityType: "CONSTRUCTION_PROJECT", deletedAt: null } } } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: users.map(({ _count, ...user }) => ({ ...user, submissionsCount: _count.uploadedAttachments })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "راجع البيانات" }, { status: 400 });
  const data = parsed.data;
  try {
    const user = await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({ where: { name: "CONTRACTING_SITE_EMPLOYEE" }, update: { nameAr: "موظف موقع مقاولات - رفع مستندات" }, create: { name: "CONTRACTING_SITE_EMPLOYEE", nameAr: "موظف موقع مقاولات - رفع مستندات" } });
      return tx.user.create({ data: {
        email: data.email.toLowerCase(), nameAr: data.nameAr, nameEn: data.nameEn || null, phone: data.phone || null,
        passwordHash: await hash(data.password, 12), mustChangePassword: true, accountType: "ADMIN",
        roles: { create: { roleId: role.id, companyId } },
        companyAccess: { create: { companyId, roleId: role.id, canView: true, canCreate: true } },
      }, select: { id: true, nameAr: true, email: true, isActive: true } });
    });
    await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "CREATE_CONTRACTING_SITE_ACCOUNT", module: "contracting", resourceId: user.id, resourceType: "User", newValues: { email: user.email, nameAr: user.nameAr } } });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ success: false, error: "البريد الإلكتروني مستخدم بالفعل" }, { status: 409 });
    console.error("Create contracting site account:", error);
    return NextResponse.json({ success: false, error: "تعذر إنشاء الحساب" }, { status: 500 });
  }
}
