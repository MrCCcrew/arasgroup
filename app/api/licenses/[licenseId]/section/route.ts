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

async function saveVersion(licenseId: string, sectionType: string, fields: Record<string, unknown>) {
  const latest = await prisma.licenseDocumentVersion.aggregate({ where: { licenseId, sectionType }, _max: { version: true } });
  await prisma.licenseDocumentVersion.create({ data: { licenseId, sectionType, version: (latest._max.version ?? 0) + 1, title: String(fields.licenseNumber ?? fields.fileNumber ?? "تعديل مستند"), fileUrl: typeof fields.fileUrl === "string" ? fields.fileUrl : null, effectiveAt: toDate(fields.issueDate ?? fields.startDate), notes: typeof fields.notes === "string" ? fields.notes : null } });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;
    const sectionType = new URL(request.url).searchParams.get("sectionType");
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, license.companyId);
    if (companyError) return companyError;

    const mainOnly = new Set(["employer_cert", "import_license", "customs_cert"]);
    if (!sectionType || (!license.isMainLicense && mainOnly.has(sectionType))) {
      return NextResponse.json({ success: false, error: "القسم غير متاح لهذا الترخيص" }, { status: 400 });
    }

    // The commercial-license card is the license identity itself, so retain its
    // name and number while clearing the document-specific data and upload.
    if (sectionType === "commercial_license") {
      await prisma.$transaction([
        prisma.licenseDocumentVersion.deleteMany({ where: { licenseId, sectionType } }),
        prisma.attachment.updateMany({
          where: { companyId: license.companyId, refModule: "LICENSE", refId: licenseId, documentCategory: "COMMERCIAL_LICENSE", deletedAt: null },
          data: { deletedAt: new Date() },
        }),
        prisma.license.update({
          where: { id: licenseId },
          data: {
            issueDate: null, licenseExpiryDate: null, commercialRegNo: null,
            unifiedEntityNumber: null, civilEntityNumber: null, fileNumber: null,
            legalEntity: null, capital: null, managerName: null, managerCivilId: null,
            managerPhone: null, email: null, notes: null, licenseAddressId: null,
          },
        }),
      ]);
      return NextResponse.json({ success: true });
    }

    const config = {
      establishment: { remove: () => prisma.establishmentContract.deleteMany({ where: { licenseId } }), category: "ESTABLISHMENT_CONTRACT", expiry: {} },
      lease: { remove: () => prisma.leaseContract.deleteMany({ where: { licenseId } }), category: "LEASE_CONTRACT", expiry: {} },
      employer_cert: { remove: () => prisma.employerSignatureCert.deleteMany({ where: { licenseId } }), category: "EMPLOYER_SIGNATURE_CERT", expiry: {} },
      import_license: { remove: () => prisma.importLicenseDoc.deleteMany({ where: { licenseId } }), category: "IMPORT_LICENSE", expiry: { importLicenseExpiryDate: null } },
      advertising: { remove: () => prisma.licenseAdvertisingDetails.deleteMany({ where: { licenseId } }), category: "ADVERTISING_LICENSE", expiry: { advertisingLicenseExpiryDate: null } },
      fire_safety: { remove: () => prisma.licenseFireSafetyCert.deleteMany({ where: { licenseId } }), category: "FIRE_SAFETY_CERT", expiry: { fireLicenseExpiryDate: null } },
      health_license: { remove: () => prisma.licenseHealthLicense.deleteMany({ where: { licenseId } }), category: "HEALTH_LICENSE", expiry: { healthLicenseExpiryDate: null } },
      chamber_commerce: { remove: () => prisma.licenseChamberOfCommerceCert.deleteMany({ where: { licenseId } }), category: "CHAMBER_OF_COMMERCE_CERT", expiry: { chamberOfCommerceExpiryDate: null } },
      traffic_cert: { remove: () => prisma.licenseTrafficCert.deleteMany({ where: { licenseId } }), category: "TRAFFIC_CERT", expiry: { trafficCertExpiryDate: null } },
      customs_cert: { remove: () => prisma.licenseCustomsCert.deleteMany({ where: { licenseId } }), category: "CUSTOMS_CERT", expiry: { customsCertExpiryDate: null } },
      manager_poa: { remove: () => prisma.managerPOA.deleteMany({ where: { licenseId } }), category: "MANAGER_POA", expiry: {} },
    } as const;
    const current = config[sectionType as keyof typeof config];
    if (!current) return NextResponse.json({ success: false, error: "نوع القسم غير معروف" }, { status: 400 });

    await prisma.$transaction([
      current.remove(),
      prisma.licenseDocumentVersion.deleteMany({ where: { licenseId, sectionType } }),
      prisma.attachment.updateMany({
        where: { companyId: license.companyId, refModule: "LICENSE", refId: licenseId, documentCategory: current.category, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      prisma.license.update({ where: { id: licenseId }, data: current.expiry }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل حذف بيانات القسم";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;
    const license = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true, isMainLicense: true } });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, license.companyId);
    if (companyError) return companyError;

    const body = await request.json();
    const { sectionType, ...fields } = body as Record<string, unknown>;
    const mainLicenseOnlySections = new Set(["employer_cert", "import_license", "customs_cert"]);
    if (!license.isMainLicense && typeof sectionType === "string" && mainLicenseOnlySections.has(sectionType)) {
      return NextResponse.json({ success: false, error: "هذا القسم متاح للترخيص الرئيسي فقط" }, { status: 400 });
    }

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
          // An empty array commonly comes from an upload-only save or a stale
          // client response. Do not erase existing signatories in that case.
          // A real replacement must contain at least one named signatory.
          const namedSignatories = Array.isArray(signatories)
            ? (signatories as { nameAr?: string; nameEn?: string }[]).filter((signatory) => signatory.nameAr?.trim())
            : null;
          if (namedSignatories && namedSignatories.length > 0) {
            await tx.authorizedSigner.deleteMany({ where: { certId: cert.id } });
            await tx.authorizedSigner.createMany({
              data: namedSignatories.map((s, i) => ({
                certId:    cert.id,
                nameAr:    s.nameAr!.trim(),
                nameEn:    s.nameEn?.trim() || null,
                sortOrder: i,
              })),
            });
          }
        });
          await saveVersion(licenseId, sectionType, fields);
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
        await saveVersion(licenseId, sectionType, fields);
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
        await saveVersion(licenseId, sectionType, fields);
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
        await saveVersion(licenseId, sectionType, fields);
        return NextResponse.json({ success: true });
      }

      case "health_license": {
        const data = {
          licenseNumber: fields.licenseNumber as string | null ?? null,
          issuingAuthority: fields.issuingAuthority as string | null ?? null,
          issueDate: toDate(fields.issueDate), expiryDate: toDate(fields.expiryDate),
          inspectionDate: toDate(fields.inspectionDate), fileUrl: fields.fileUrl as string | null ?? null,
          notes: fields.notes as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseHealthLicense.upsert({ where: { licenseId }, create: { licenseId, ...data }, update: data });
          await tx.license.update({ where: { id: licenseId }, data: { healthLicenseExpiryDate: data.expiryDate } });
        });
        await saveVersion(licenseId, sectionType, fields);
        return NextResponse.json({ success: true });
      }

      // ── [9] اعتماد المرور ────────────────────────────────────────────────────
      case "chamber_commerce": {
        const data = {
          issueDate: toDate(fields.issueDate),
          expiryDate: toDate(fields.expiryDate),
          fileUrl: fields.fileUrl as string | null ?? null,
        };
        await prisma.$transaction(async (tx) => {
          await tx.licenseChamberOfCommerceCert.upsert({
            where: { licenseId },
            create: { licenseId, ...data },
            update: data,
          });
          await tx.license.update({
            where: { id: licenseId },
            data: { chamberOfCommerceExpiryDate: data.expiryDate },
          });
        });
        await saveVersion(licenseId, sectionType, fields);
        return NextResponse.json({ success: true });
      }

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
        await saveVersion(licenseId, sectionType, fields);
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
        await saveVersion(licenseId, sectionType, fields);
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
        await saveVersion(licenseId, sectionType, fields);
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
