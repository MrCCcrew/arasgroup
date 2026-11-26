import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/permissions";

const schema = z.object({ nameAr: z.string().trim().min(2), nameEn: z.string().trim().max(120).optional().or(z.literal("")), email: z.string().trim().email(), phone: z.string().trim().max(30).optional().or(z.literal("")), password: z.string().min(8) });
async function access(request: NextRequest, companyId: string) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  if (!hasPermission(session, "GROCERY", "UPDATE", { companyId })) return NextResponse.json({ success: false, error: "You are not authorized to manage grocery employee accounts" }, { status: 403 });
  const company = await prisma.company.findFirst({ where: { id: companyId, type: { in: ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] }, isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "Grocery operations are not enabled for this company" }, { status: 404 });
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId); if (session instanceof NextResponse) return session;
  const users = await prisma.user.findMany({ where: { roles: { some: { companyId, role: { name: "GROCERY_EMPLOYEE" } } } }, select: { id: true, nameAr: true, nameEn: true, email: true, phone: true, isActive: true, createdAt: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: users });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId); if (session instanceof NextResponse) return session;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ success: false, error: "Please review the employee account details" }, { status: 400 });
  try {
    const input = parsed.data; const user = await prisma.$transaction(async tx => {
      const role = await tx.role.upsert({ where: { name: "GROCERY_EMPLOYEE" }, update: { nameAr: "موظف بقالة - رفع المبيعات والإيداعات" }, create: { name: "GROCERY_EMPLOYEE", nameAr: "موظف بقالة - رفع المبيعات والإيداعات" } });
      return tx.user.create({ data: { email: input.email.toLowerCase(), nameAr: input.nameAr, nameEn: input.nameEn || null, phone: input.phone || null, passwordHash: await hash(input.password, 12), mustChangePassword: true, accountType: "GROCERY_EMPLOYEE", roles: { create: { roleId: role.id, companyId } }, companyAccess: { create: { companyId, roleId: role.id, canView: true, canCreate: true } } }, select: { id: true, nameAr: true, email: true, isActive: true } });
    });
    return NextResponse.json({ success: true, data: user }, { status: 201 });
  } catch (error) { if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ success: false, error: "This email is already in use" }, { status: 409 }); return NextResponse.json({ success: false, error: "Unable to create employee account" }, { status: 500 }); }
}
