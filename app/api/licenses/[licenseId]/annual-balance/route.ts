import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    const body = await request.json() as Record<string, unknown>;
    const year = Number(body.year);
    if (!year) return NextResponse.json({ success: false, error: "السنة مطلوبة" }, { status: 400 });
    if (!body.fileUrl) return NextResponse.json({ success: false, error: "الملف مطلوب" }, { status: 400 });

    // upsert by year (replace if exists)
    const existing = await prisma.licenseAnnualBalance.findUnique({ where: { licenseId_year: { licenseId, year } } });
    if (existing) {
      await prisma.licenseAnnualBalance.update({
        where: { licenseId_year: { licenseId, year } },
        data: {
          fileUrl:    body.fileUrl    as string,
          accountant: body.accountant as string | null ?? null,
          notes:      body.notes      as string | null ?? null,
        },
      });
    } else {
      await prisma.licenseAnnualBalance.create({
        data: {
          licenseId,
          year,
          fileUrl:    body.fileUrl    as string,
          accountant: body.accountant as string | null ?? null,
          notes:      body.notes      as string | null ?? null,
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
