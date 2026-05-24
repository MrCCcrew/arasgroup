/**
 * PUT — upsert quarterly work injury insurance record
 * Body: { year, quarter(1-4), policyNumber?, certificateNo?, startDate?, endDate?, fileUrl? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }
function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    const body = await request.json() as Record<string, unknown>;
    const year    = Number(body.year);
    const quarter = Number(body.quarter);
    if (!year || ![1, 2, 3, 4].includes(quarter)) {
      return NextResponse.json({ success: false, error: "السنة والربع مطلوبان" }, { status: 400 });
    }

    const data = {
      policyNumber:  body.policyNumber  as string | null ?? null,
      certificateNo: body.certificateNo as string | null ?? null,
      startDate:     toDate(body.startDate),
      endDate:       toDate(body.endDate),
      fileUrl:       body.fileUrl       as string | null ?? null,
    };

    await prisma.workInjuryInsurance.upsert({
      where:  { licenseId_year_quarter: { licenseId, year, quarter } },
      create: { licenseId, year, quarter, ...data },
      update: data,
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const url    = new URL(request.url);
    const year   = Number(url.searchParams.get("year"));
    const quarter = Number(url.searchParams.get("quarter"));
    if (!year || !quarter) return NextResponse.json({ success: false, error: "year و quarter مطلوبان" }, { status: 400 });

    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    await prisma.workInjuryInsurance.delete({ where: { licenseId_year_quarter: { licenseId, year, quarter } } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
