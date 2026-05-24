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
    if (!body.fileUrl) return NextResponse.json({ success: false, error: "الملف مطلوب" }, { status: 400 });

    const receipt = await prisma.licenseRentReceipt.create({
      data: {
        licenseId,
        receiptDate: toDate(body.receiptDate),
        amount:      body.amount != null ? Number(body.amount) : null,
        fileUrl:     body.fileUrl as string,
        notes:       body.notes   as string | null ?? null,
      },
    });
    return NextResponse.json({ success: true, data: receipt });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
