import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string; violationId: string }> }
function toDate(value: unknown): Date | null { if (!value || typeof value !== "string") return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }

async function authorize(request: NextRequest, licenseId: string) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
  if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
  return assertCompanyAccess(session, license.companyId) ?? true;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const { licenseId, violationId } = await params;
  const allowed = await authorize(request, licenseId); if (allowed instanceof NextResponse) return allowed;
  try {
    const body = await request.json() as Record<string, unknown>;
    const violation = await prisma.licenseViolation.findFirst({ where: { id: violationId, licenseId } });
    if (!violation) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });
    const amount = body.amount !== undefined ? Number(body.amount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) return NextResponse.json({ success: false, error: "قيمة المخالفة غير صحيحة" }, { status: 400 });
    await prisma.licenseViolation.update({ where: { id: violationId }, data: {
      ...(body.violationDate ? { violationDate: toDate(body.violationDate) ?? violation.violationDate } : {}),
      ...(typeof body.violatorName === "string" ? { violatorName: body.violatorName.trim() } : {}),
      ...(amount !== undefined ? { amount } : {}), ...(typeof body.fileUrl === "string" && body.fileUrl ? { fileUrl: body.fileUrl } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    } });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل تعديل المخالفة" }, { status: 500 }); }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const { licenseId, violationId } = await params;
  const allowed = await authorize(request, licenseId); if (allowed instanceof NextResponse) return allowed;
  const violation = await prisma.licenseViolation.findFirst({ where: { id: violationId, licenseId }, select: { id: true } });
  if (!violation) return NextResponse.json({ success: false, error: "المخالفة غير موجودة" }, { status: 404 });
  await prisma.licenseViolation.delete({ where: { id: violationId } });
  return NextResponse.json({ success: true });
}
