/**
 * GET /api/licenses/[licenseId]/sections
 * Returns all 14 document sections for a license in one call.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props { params: Promise<{ licenseId: string }> }

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;

    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      select: { companyId: true },
    });
    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, license.companyId);
    if (companyError) return companyError;

    // Each card is independent. A missing table, legacy record, or an older
    // generated Prisma client in one optional card must never make the whole
    // page lose its saved data.
    //
    // The delegate checks are deliberately outside Promise.allSettled: calling
    // an absent delegate while constructing that array throws synchronously and
    // prevents Promise.allSettled from isolating the error.
    const violationsQuery = prisma.licenseViolation
      ? prisma.licenseViolation.findMany({
        where: { licenseId },
        orderBy: [{ violationDate: "desc" }, { createdAt: "desc" }],
      })
      : Promise.resolve([]);
    const partnerCivilIdsQuery = prisma.licensePartnerCivilId
      ? prisma.licensePartnerCivilId.findMany({
        where: { licenseId },
        orderBy: { partnerNameAr: "asc" },
      })
      : Promise.resolve([]);

    const sectionResults = await Promise.allSettled([
      prisma.establishmentContract.findMany({
        where: { licenseId },
        include: { partners: { orderBy: { sortOrder: "asc" } } },
        orderBy: { version: "desc" },
      }),
      prisma.leaseContract.findMany({
        where: { licenseId },
        orderBy: { version: "desc" },
      }),
      prisma.employerSignatureCert.findUnique({
        where: { licenseId },
        include: { signatories: { orderBy: { sortOrder: "asc" } } },
      }),
      prisma.licenseRentReceipt.findMany({
        where: { licenseId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.importLicenseDoc.findUnique({ where: { licenseId } }),
      prisma.licenseAdvertisingDetails.findUnique({ where: { licenseId } }),
      prisma.licenseFireSafetyCert.findUnique({ where: { licenseId } }),
      prisma.licenseHealthLicense.findUnique({ where: { licenseId } }),
      prisma.licenseTrafficCert.findUnique({ where: { licenseId } }),
      prisma.licenseCustomsCert.findUnique({ where: { licenseId } }),
      prisma.licenseVehicle.findMany({
        where: { licenseId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.managerPOA.findUnique({ where: { licenseId } }),
      prisma.workInjuryInsurance.findMany({
        where: { licenseId },
        orderBy: [{ year: "desc" }, { quarter: "desc" }],
      }),
      prisma.licenseAnnualBalance.findMany({
        where: { licenseId },
        orderBy: { year: "desc" },
      }),
      violationsQuery,
      partnerCivilIdsQuery,
    ]);

    const sectionValue = <T,>(index: number, fallback: T): T => {
      const result = sectionResults[index];
      return result.status === "fulfilled" ? result.value as T : fallback;
    };
    const failedSections = sectionResults.flatMap((result, index) =>
      result.status === "rejected" ? [index] : [],
    );

    const establishmentContracts = sectionValue(0, []);
    const leaseContracts = sectionValue(1, []);
    const employerSignatureCert = sectionValue(2, null);
    const rentReceipts = sectionValue(3, []);
    const importLicenseDoc = sectionValue(4, null);
    const advertisingDetails = sectionValue(5, null);
    const fireSafetyCert = sectionValue(6, null);
    const healthLicense = sectionValue(7, null);
    const trafficCert = sectionValue(8, null);
    const customsCert = sectionValue(9, null);
    const licenseVehicles = sectionValue(10, []);
    const managerPOA = sectionValue(11, null);
    const workInjuryInsurances = sectionValue(12, []);
    const annualBalances = sectionValue(13, []);
    const violations = sectionValue(14, []);
    const partnerCivilIds = sectionValue(15, []);

    return NextResponse.json({
      success: true,
      data: {
        establishmentContracts,
        leaseContracts,
        employerSignatureCert,
        rentReceipts,
        importLicenseDoc,
        advertisingDetails,
        fireSafetyCert,
        healthLicense,
        trafficCert,
        customsCert,
        licenseVehicles,
        managerPOA,
        workInjuryInsurances,
        annualBalances,
        violations,
        partnerCivilIds,
      },
      partialFailures: failedSections,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Failed to load license sections", error);
    return NextResponse.json({ success: false, error: "فشل في جلب بيانات الأقسام" }, { status: 500 });
  }
}
