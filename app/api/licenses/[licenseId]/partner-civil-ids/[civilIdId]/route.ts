import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string; civilIdId: string }> }
function toDate(value: unknown): Date | null { if (!value || typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }

async function authorize(request: NextRequest, licenseId: string) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
  if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
  const accessError = assertCompanyAccess(session, license.companyId); if (accessError) return accessError;
  if (!license.isMainLicense) return NextResponse.json({ success: false, error: "مدنيات الشركاء متاحة للترخيص الرئيسي فقط" }, { status: 400 });
  return true;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { licenseId, civilIdId } = await params; const allowed = await authorize(request, licenseId); if (allowed instanceof NextResponse) return allowed;
  const item = await prisma.licensePartnerCivilId.findFirst({ where: { id: civilIdId, licenseId } });
  if (!item) return NextResponse.json({ success: false, error: "البطاقة غير موجودة" }, { status: 404 });
  const body = await request.json() as Record<string, unknown>;
  await prisma.licensePartnerCivilId.update({ where: { id: civilIdId }, data: {
    ...(typeof body.partnerNameAr === "string" && body.partnerNameAr.trim() ? { partnerNameAr: body.partnerNameAr.trim() } : {}),
    ...(typeof body.civilId === "string" ? { civilId: body.civilId } : {}),
    ...(body.expiryDate !== undefined ? { expiryDate: toDate(body.expiryDate) } : {}),
    ...(typeof body.fileUrl === "string" && body.fileUrl ? { fileUrl: body.fileUrl } : {}),
  } });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { licenseId, civilIdId } = await params; const allowed = await authorize(request, licenseId); if (allowed instanceof NextResponse) return allowed;
  const item = await prisma.licensePartnerCivilId.findFirst({ where: { id: civilIdId, licenseId }, select: { id: true } });
  if (!item) return NextResponse.json({ success: false, error: "البطاقة غير موجودة" }, { status: 404 });
  await prisma.licensePartnerCivilId.delete({ where: { id: civilIdId } });
  return NextResponse.json({ success: true });
}
