import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }
function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    const body = await request.json() as Record<string, unknown>;

    const newVer = await prisma.$transaction(async (tx) => {
      const last = await tx.leaseContract.findFirst({ where: { licenseId }, orderBy: { version: "desc" }, select: { version: true } });
      const ver = (last?.version ?? 0) + 1;
      await tx.leaseContract.updateMany({ where: { licenseId, isActive: true }, data: { isActive: false } });
      await tx.leaseContract.create({
        data: {
          licenseId,
          version:      ver,
          isActive:     true,
          holderType:   body.holderType  as string ?? "INVESTOR",
          holderNameAr: body.holderNameAr as string | null ?? null,
          startDate:    toDate(body.startDate),
          endDate:      toDate(body.endDate),
          monthlyRent:  body.monthlyRent != null ? Number(body.monthlyRent) : null,
          notes:        body.notes   as string | null ?? null,
          fileUrl:      body.fileUrl as string | null ?? null,
        },
      });
      return ver;
    });

    return NextResponse.json({ success: true, data: { version: newVer } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const contractId = new URL(request.url).searchParams.get("contractId");
    if (!contractId) return NextResponse.json({ success: false, error: "contractId مطلوب" }, { status: 400 });
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
    const c = await prisma.leaseContract.findFirst({ where: { id: contractId, licenseId } });
    if (!c) return NextResponse.json({ success: false, error: "العقد غير موجود" }, { status: 404 });
    if (c.isActive) return NextResponse.json({ success: false, error: "لا يمكن حذف النسخة النشطة" }, { status: 400 });
    await prisma.leaseContract.delete({ where: { id: contractId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
