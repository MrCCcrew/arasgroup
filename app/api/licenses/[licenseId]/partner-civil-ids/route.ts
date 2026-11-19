import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }
function toDate(value: unknown): Date | null { if (!value || typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, license.companyId);
    if (accessError) return accessError;
    if (!license.isMainLicense) return NextResponse.json({ success: false, error: "مدنيات الشركاء متاحة للترخيص الرئيسي فقط" }, { status: 400 });

    const body = await request.json() as Record<string, unknown>;
    const partnerNameAr = typeof body.partnerNameAr === "string" ? body.partnerNameAr.trim() : "";
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
    if (!partnerNameAr || !fileUrl) return NextResponse.json({ success: false, error: "اختر الشريك وارفع صورة البطاقة" }, { status: 400 });
    const item = await prisma.licensePartnerCivilId.upsert({
      where: { licenseId_partnerNameAr: { licenseId, partnerNameAr } },
      create: { licenseId, partnerNameAr, civilId: typeof body.civilId === "string" ? body.civilId : null, expiryDate: toDate(body.expiryDate), fileUrl },
      update: { civilId: typeof body.civilId === "string" ? body.civilId : null, expiryDate: toDate(body.expiryDate), fileUrl },
    });
    return NextResponse.json({ success: true, data: item });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل حفظ البطاقة" }, { status: 500 }); }
}
