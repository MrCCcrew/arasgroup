import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string; receiptId: string }> }

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId, receiptId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
    await prisma.licenseRentReceipt.delete({ where: { id: receiptId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
