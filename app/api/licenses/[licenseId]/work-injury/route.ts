/**
 * PUT — upsert quarterly work injury insurance record
 * Body: { year, quarter(1-4), policyNumber?, certificateNo?, startDate?, endDate?, fileUrl? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { upsertNotification } from "@/lib/notifications";
import { isWorkInjuryDueSoon, workInjuryQuarterExpiryDate } from "@/lib/licenses/work-injury";

interface Props { params: Promise<{ licenseId: string }> }
function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

function versionTitle(year: number, quarter: number) {
  return `\u062a\u0623\u0645\u064a\u0646 \u0625\u0635\u0627\u0628\u0627\u062a \u0627\u0644\u0639\u0645\u0644 - ${year} Q${quarter}`;
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
    if (!lic.isMainLicense) return NextResponse.json({ success: false, error: "تأمين إصابات العمل متاح للترخيص الرئيسي فقط" }, { status: 400 });

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

    const insurance = await prisma.$transaction(async (tx) => {
      const saved = await tx.workInjuryInsurance.upsert({
        where:  { licenseId_year_quarter: { licenseId, year, quarter } },
        create: { licenseId, year, quarter, ...data },
        update: data,
      });
      const latest = await tx.licenseDocumentVersion.aggregate({
        where: { licenseId, sectionType: "work_injury" },
        _max: { version: true },
      });
      await tx.licenseDocumentVersion.create({
        data: {
          licenseId,
          sectionType: "work_injury",
          version: (latest._max.version ?? 0) + 1,
          title: versionTitle(year, quarter),
          fileUrl: data.fileUrl,
          effectiveAt: data.endDate,
        },
      });
      return saved;
    });
    const now = new Date();
    const details = await prisma.license.findUnique({ where: { id: licenseId }, select: { commercialNameAr: true, branchId: true } });
    const quarterExpiry = workInjuryQuarterExpiryDate(year, quarter);
    if (isWorkInjuryDueSoon(quarterExpiry, now)) {
      await upsertNotification({
        type: "WORK_INJURY_QUARTER_EXPIRY",
        uniqueKey: `license:${licenseId}:work-injury-quarter:${year}:q${quarter}:${quarterExpiry.toISOString().slice(0, 10)}`,
        titleAr: "\u062a\u0646\u0628\u064a\u0647 \u0627\u0646\u062a\u0647\u0627\u0621 \u0633\u062c\u0644 \u0631\u0628\u0639 \u0627\u0644\u0625\u0635\u0627\u0628\u0627\u062a",
        titleEn: "Work injury quarter record expiry alert",
        messageAr: `\u0633\u062c\u0644 \u0627\u0644\u0631\u0628\u0639 \u0644\u062a\u0623\u0645\u064a\u0646 \u0625\u0635\u0627\u0628\u0627\u062a \u0627\u0644\u0639\u0645\u0644 \u0644\u0640 ${details?.commercialNameAr ?? ""} \u2014 ${year} Q${quarter} \u064a\u0646\u062a\u0647\u064a \u0642\u0631\u064a\u0628\u064b\u0627`,
        companyId: lic.companyId,
        branchId: details?.branchId ?? undefined,
        licenseId,
        entityType: "WORK_INJURY_INSURANCE",
        entityId: insurance.id,
        dueDate: quarterExpiry,
        severity: "WARNING",
        targetRole: "ADMINISTRATIVE_AFFAIRS",
        refModule: "licenses",
        refId: licenseId,
      });
    }
    if (isWorkInjuryDueSoon(insurance.endDate, now)) {
      await upsertNotification({
        type: "WORK_INJURY_INSURANCE_EXPIRY",
        uniqueKey: `license:${licenseId}:work-injury-certificate:${year}:q${quarter}:${insurance.endDate!.toISOString().slice(0, 10)}`,
        titleAr: "\u062a\u0646\u0628\u064a\u0647 \u0627\u0646\u062a\u0647\u0627\u0621 \u0634\u0647\u0627\u062f\u0629 \u062a\u0623\u0645\u064a\u0646 \u0625\u0635\u0627\u0628\u0627\u062a \u0627\u0644\u0639\u0645\u0644",
        titleEn: "Work injury insurance certificate expiry alert",
        messageAr: `\u0634\u0647\u0627\u062f\u0629 \u062a\u0623\u0645\u064a\u0646 \u0625\u0635\u0627\u0628\u0627\u062a \u0627\u0644\u0639\u0645\u0644 \u0644\u0640 ${details?.commercialNameAr ?? ""} \u064a\u0646\u062a\u0647\u064a \u0642\u0631\u064a\u0628\u064b\u0627`,
        companyId: lic.companyId, branchId: details?.branchId ?? undefined, licenseId,
        entityType: "WORK_INJURY_INSURANCE", entityId: insurance.id, dueDate: insurance.endDate,
        severity: "WARNING", targetRole: "ADMINISTRATIVE_AFFAIRS", refModule: "licenses", refId: licenseId,
      });
    }
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

    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
    if (!lic.isMainLicense) return NextResponse.json({ success: false, error: "تأمين إصابات العمل متاح للترخيص الرئيسي فقط" }, { status: 400 });

    const existing = await prisma.workInjuryInsurance.findUnique({ where: { licenseId_year_quarter: { licenseId, year, quarter } }, select: { fileUrl: true } });
    await prisma.$transaction([
      prisma.workInjuryInsurance.delete({ where: { licenseId_year_quarter: { licenseId, year, quarter } } }),
      prisma.licenseDocumentVersion.deleteMany({ where: { licenseId, sectionType: "work_injury", title: versionTitle(year, quarter) } }),
      ...(existing?.fileUrl ? [prisma.attachment.updateMany({
        where: { companyId: lic.companyId, refModule: "LICENSE", refId: licenseId, documentCategory: "WORK_INJURY", filePath: existing.fileUrl, deletedAt: null },
        data: { deletedAt: new Date() },
      })] : []),
    ]);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
