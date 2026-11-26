import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { invalidateSessionCache } from "@/lib/auth/session";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/permissions";

const updateSchema = z.object({ isActive: z.boolean().optional(), password: z.string().min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف").optional() }).refine(value => value.isActive !== undefined || value.password, "لم يتم تحديد تعديل");

async function access(request: NextRequest, companyId: string) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId);
  if (companyError) return companyError;
  if (!(hasPermission(session, "CONTRACTING", "UPDATE", { companyId }) || hasPermission(session, "ACCOUNTING", "UPDATE", { companyId }))) return NextResponse.json({ success: false, error: "غير مصرح بإدارة حسابات موظفي الموقع" }, { status: 403 });
  const company = await prisma.company.findFirst({ where: { id: companyId, type: "CONTRACTING", isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "هذه الخدمة متاحة لشركات المقاولات فقط" }, { status: 404 });
}

async function siteUser(userId: string, companyId: string) {
  return prisma.user.findFirst({ where: { id: userId, roles: { some: { companyId, role: { name: "CONTRACTING_SITE_EMPLOYEE" } } } }, select: { id: true, nameAr: true, email: true, isActive: true, _count: { select: { uploadedAttachments: { where: { companyId, entityType: "CONSTRUCTION_PROJECT", deletedAt: null } } } } } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ companyId: string; userId: string }> }) {
  const { companyId, userId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? "راجع البيانات" }, { status: 400 });
  const user = await siteUser(userId, companyId);
  if (!user) return NextResponse.json({ success: false, error: "حساب موظف الموقع غير موجود" }, { status: 404 });
  const data = parsed.data;
  const updated = await prisma.user.update({ where: { id: userId }, data: { ...(data.isActive !== undefined ? { isActive: data.isActive } : {}), ...(data.password ? { passwordHash: await hash(data.password, 12), mustChangePassword: true } : {}) }, select: { id: true, isActive: true } });
  invalidateSessionCache(userId);
  await prisma.auditLog.create({ data: { userId: session.id, companyId, action: data.password ? "RESET_CONTRACTING_SITE_PASSWORD" : updated.isActive ? "ACTIVATE_CONTRACTING_SITE_ACCOUNT" : "DEACTIVATE_CONTRACTING_SITE_ACCOUNT", module: "contracting", resourceId: userId, resourceType: "User", newValues: { isActive: updated.isActive, passwordChanged: Boolean(data.password) } } });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ companyId: string; userId: string }> }) {
  const { companyId, userId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const user = await siteUser(userId, companyId);
  if (!user) return NextResponse.json({ success: false, error: "حساب موظف الموقع غير موجود" }, { status: 404 });
  if (user._count.uploadedAttachments > 0) return NextResponse.json({ success: false, error: "لا يمكن إلغاء حساب له مستندات مرفوعة؛ أوقفه للحفاظ على سجل المستندات" }, { status: 400 });
  await prisma.user.delete({ where: { id: userId } });
  invalidateSessionCache(userId);
  await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "DELETE_CONTRACTING_SITE_ACCOUNT", module: "contracting", resourceId: userId, resourceType: "User", oldValues: { nameAr: user.nameAr, email: user.email } } });
  return NextResponse.json({ success: true });
}
