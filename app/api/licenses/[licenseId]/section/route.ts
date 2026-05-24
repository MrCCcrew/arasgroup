/**
 * PUT /api/licenses/[licenseId]/section
 * Upserts one of the simple one-to-one document sections.
 * Body: { sectionType, ...fields }
 *
 * sectionType values:
 *   employer_cert | import_license | advertising | fire_safety |
 *   traffic_cert  | customs_cert   | manager_poa
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }

function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, license.companyId);
    if (companyError) return companyError;

    const body = await request.json();
    const { sectionType, ...fields } = body as Record<string, unknown>;

    switch (sectionType) {

      // ── [4] اعتماد توقيع صاحب العمل ─────────────────────────────────────────
      // CRITICAL: upsert cert + delete-then-replace signatories must be atomic
      case "employer_cert": {
        const { signatories, ...certFields } = fields as Record<string, unknown>;
        const data = {
          fileNumber:     certFields.fileNumber     as string | null ?? null,
          tradeName:      certFields.tradeName      as string | null ?? null,
          companyCivilId: certFields.companyCivilId as string | null ?? null,
          unifiedNumber:  certFields.unifiedNumber  as string | null ?? null,
          governorate:    certFields.governorate    as string | null ?? null,
          issueDate:      toDate(certFields.issueDate),
          expiryDate:     toDate(certFields.expiryDate),
          fileUrl:        certFields.fileUrl        as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          const cert = await tx.employerSignatureCert.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (Array.isArray(signatories)) {
            await tx.authorizedSigner.deleteMany({ where: { certId: cert.id } });
            if (signatories.length > 0) {
              await tx.authorizedSigner.createMany({
                data: (signatories as { nameAr: string; nameEn?: string }[]).map((s, i) => ({
                  certId:    cert.id,
                  nameAr:    s.nameAr,
                  nameEn:    s.nameEn ?? null,
                  sortOrder: i,
                })),
              });
            }
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [6] ترخيص الاستيراد ──────────────────────────────────────────────────
      // upsert doc + sync expiry on license record — must be atomic
      case "import_license": {
        const data = {
          licenseNumber: fields.licenseNumber as string | null ?? null,
          startDate:     toDate(fields.startDate),
          endDate:       toDate(fields.endDate),
          fileUrl:       fields.fileUrl       as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.importLicenseDoc.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (data.endDate !== undefined) {
            await tx.license.update({ where: { id: licenseId }, data: { importLicenseExpiryDate: data.endDate } });
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [7] ترخيص الإعلان ────────────────────────────────────────────────────
      case "advertising": {
        const data = {
          adLicenseNumber:         fields.adLicenseNumber         as string | null ?? null,
          commercialLicenseNo:     fields.commercialLicenseNo     as string | null ?? null,
          issueDate:               toDate(fields.issueDate),
          expiryDate:              toDate(fields.expiryDate),
          commercialLicenseExpiry: toDate(fields.commercialLicenseExpiry),
          municipalityAddress:     fields.municipalityAddress     as string | null ?? null,
          district:                fields.district                as string | null ?? null,
          street:                  fields.street                  as string | null ?? null,
          block:                   fields.block                   as string | null ?? null,
          fileUrl:                 fields.fileUrl                 as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseAdvertisingDetails.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (data.expiryDate !== undefined) {
            await tx.license.update({ where: { id: licenseId }, data: { advertisingLicenseExpiryDate: data.expiryDate } });
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [8] رخصة الإطفاء ─────────────────────────────────────────────────────
      case "fire_safety": {
        const data = {
          licenseNumber: fields.licenseNumber as string | null ?? null,
          issueDate:     toDate(fields.issueDate),
          expiryDate:    toDate(fields.expiryDate),
          fileUrl:       fields.fileUrl       as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseFireSafetyCert.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (data.expiryDate !== undefined) {
            await tx.license.update({ where: { id: licenseId }, data: { fireLicenseExpiryDate: data.expiryDate } });
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [9] اعتماد المرور ────────────────────────────────────────────────────
      case "traffic_cert": {
        const data = {
          issueDate:  toDate(fields.issueDate),
          expiryDate: toDate(fields.expiryDate),
          fileUrl:    fields.fileUrl as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseTrafficCert.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (data.expiryDate !== undefined) {
            await tx.license.update({ where: { id: licenseId }, data: { trafficCertExpiryDate: data.expiryDate } });
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [10] اعتماد الجمارك ──────────────────────────────────────────────────
      case "customs_cert": {
        const data = {
          issueDate:  toDate(fields.issueDate),
          expiryDate: toDate(fields.expiryDate),
          fileUrl:    fields.fileUrl as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseCustomsCert.upsert({
            where:  { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          if (data.expiryDate !== undefined) {
            await tx.license.update({ where: { id: licenseId }, data: { customsCertExpiryDate: data.expiryDate } });
          }
        });
        return NextResponse.json({ success: true });
      }

      // ── [12] وكالة المدير — single upsert, no secondary ops needed ───────────
      case "manager_poa": {
        const data = {
          principalName: fields.principalName as string | null ?? null,
          agentName:     fields.agentName     as string | null ?? null,
          issueDate:     toDate(fields.issueDate),
          expiryDate:    toDate(fields.expiryDate),
          fileUrl:       fields.fileUrl       as string | null ?? null,
          notes:         fields.notes         as string | null ?? null,
        };
        await prisma.managerPOA.upsert({
          where:  { licenseId },
          create: { licenseId, ...data },
          update: data,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: "نوع القسم غير معروف" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ البيانات";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
