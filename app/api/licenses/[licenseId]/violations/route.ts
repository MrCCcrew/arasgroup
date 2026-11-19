import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }

function toDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const accessError = assertCompanyAccess(session, license.companyId);
    if (accessError) return accessError;

    const body = await request.json() as Record<string, unknown>;
    const violationDate = toDate(body.violationDate);
    const violatorName = typeof body.violatorName === "string" ? body.violatorName.trim() : "";
    const amount = Number(body.amount);
    const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : "";
    if (!violationDate || !violatorName || !Number.isFinite(amount) || amount < 0 || !fileUrl) {
      return NextResponse.json({ success: false, error: "أدخل تاريخ المخالفة واسم صاحبها وقيمتها وصورتها" }, { status: 400 });
    }

    const violation = await prisma.licenseViolation.create({
      data: { licenseId, violationDate, violatorName, amount, fileUrl, notes: typeof body.notes === "string" ? body.notes : null },
    });
    return NextResponse.json({ success: true, data: violation });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل حفظ المخالفة" }, { status: 500 });
  }
}
