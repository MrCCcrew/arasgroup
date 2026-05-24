/**
 * GET /api/licenses/[licenseId]/sections
 * Returns all 14 document sections for a license in one call.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

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

    const [
      establishmentContracts,
      leaseContracts,
      employerSignatureCert,
      rentReceipts,
      importLicenseDoc,
      advertisingDetails,
      fireSafetyCert,
      trafficCert,
      customsCert,
      licenseVehicles,
      managerPOA,
      workInjuryInsurances,
      annualBalances,
    ] = await Promise.all([
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
      prisma.licenseTrafficCert.findUnique({ where: { licenseId } }),
      prisma.licenseCustomsCert.findUnique({ where: { licenseId } }),
      prisma.licenseVehicle.findMany({
        where: { licenseId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.managerPOA.findUnique({ where: { licenseId } }),
      prisma.workInjuryInsurance.findMany({
        where: { licenseId },
        orderBy: [{ year: "desc" }, { quarter: "asc" }],
      }),
      prisma.licenseAnnualBalance.findMany({
        where: { licenseId },
        orderBy: { year: "desc" },
      }),
    ]);

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
        trafficCert,
        customsCert,
        licenseVehicles,
        managerPOA,
        workInjuryInsurances,
        annualBalances,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب بيانات الأقسام" }, { status: 500 });
  }
}
