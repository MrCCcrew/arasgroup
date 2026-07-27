import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { requireOwnerManagedCompany, forbidden } from "@/lib/owner-management/access";
import { normalizeMid } from "@/lib/owner-management/nbk-parser";

const input = z.object({ name: z.string().min(2), phone: z.string().optional(), email: z.string().email(), password: z.string().min(8), mid: z.string() });
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { companyId } = await params; if (!await requireOwnerManagedCompany(session, companyId)) return forbidden();
  return NextResponse.json({ success: true, data: await prisma.ownerManagedPartner.findMany({ where: { companyId }, include: { user: { select: { email: true } }, _count: { select: { expenses: true, revenues: true } } }, orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { companyId } = await params; if (!await requireOwnerManagedCompany(session, companyId)) return forbidden();
  const parsed = input.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ success: false, error: "بيانات الشريك غير صحيحة" }, { status: 400 });
  const mid = normalizeMid(parsed.data.mid); if (!mid) return NextResponse.json({ success: false, error: "MID يجب أن يكون 8-12 أرقام إنجليزية" }, { status: 400 });
  try {
    const [existingUser, existingPartner] = await Promise.all([
      prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() }, select: { id: true } }),
      prisma.ownerManagedPartner.findFirst({ where: { companyId, mid }, select: { id: true } }),
    ]);
    if (existingUser) return NextResponse.json({ success: false, error: "البريد الإلكتروني مستخدم بالفعل." }, { status: 400 });
    if (existingPartner) return NextResponse.json({ success: false, error: "رقم MID مسجل بالفعل لهذه الشركة." }, { status: 400 });
    const role = await prisma.role.upsert({ where: { name: "OWNER_MANAGED_PARTNER" }, update: {}, create: { name: "OWNER_MANAGED_PARTNER", nameAr: "شريك إدارة المالك" } });
    const partner = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: parsed.data.email, nameAr: parsed.data.name, phone: parsed.data.phone, passwordHash: await hash(parsed.data.password, 12), accountType: "OWNER_MANAGED_PARTNER", mustChangePassword: true, roles: { create: { roleId: role.id, companyId } }, companyAccess: { create: { companyId, canView: true } } } });
      return tx.ownerManagedPartner.create({ data: { companyId, userId: user.id, name: parsed.data.name, phone: parsed.data.phone, email: parsed.data.email, mid } });
    });
    return NextResponse.json({ success: true, data: partner }, { status: 201 });
  } catch { return NextResponse.json({ success: false, error: "البريد أو MID مستخدم بالفعل" }, { status: 409 }); }
}
