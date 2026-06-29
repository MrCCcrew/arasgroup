import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleCompanyIds } from "@/lib/auth/permissions";
import { upsertNotification } from "@/lib/notifications";

const nullStr = z.string().optional().nullable().transform((v) => v || undefined);
const nullDate = z.string().optional().nullable().transform((v) => (v ? new Date(v) : undefined));

const licenseSchema = z.object({
  companyId: z.string(),
  branchId: nullStr,
  investorId: nullStr,
  licenseNumber: z.string().min(1, "رقم الترخيص مطلوب"),
  issueDate: nullDate,
  unifiedEntityNumber: nullStr,
  civilEntityNumber: nullStr,
  fileNumber: nullStr,
  licenseExpiryDate: nullDate,
  commercialNameAr: z.string().min(2, "الاسم التجاري العربي مطلوب"),
  commercialNameEn: nullStr,
  isMainLicense: z.boolean().default(true),
  mainLicenseId: nullStr,
  ownerOrInvestorNameAr: nullStr,
  ownerOrInvestorNameEn: nullStr,
  ownerOrInvestorPhone: nullStr,
  investmentAmount: z.number().optional().nullable(),
  investmentCycle: nullStr,
  rentAmount: z.number().optional().nullable(),
  rentCycle: nullStr,
  totalInvestmentAmount: z.number().optional().nullable(),
  totalInvestmentCycle: nullStr,
  investmentRenewalDate: nullDate,
  managerName: nullStr,
  managerPhone: nullStr,
  legalEntity: nullStr,
  capital: z.number().optional().nullable(),
  commercialRegNo: nullStr,
  fireLicenseExpiryDate: nullDate,
  healthLicenseExpiryDate: nullDate,
  advertisingLicenseExpiryDate: nullDate,
  status: z.string().default("ACTIVE"),
  notes: nullStr,
  address: z.object({
    automaticNumber: z.string().optional(),
    governorate: z.string().optional(),
    area: z.string().optional(),
    block: z.string().optional(),
    plot: z.string().optional(),
    street: z.string().optional(),
    buildingName: z.string().optional(),
    floor: z.string().optional(),
    unitType: z.string().optional(),
    unitNumber: z.string().optional(),
  }).optional(),
});

async function findDefaultCompanyMainLicenseId(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { mainLicenseNumber: true },
  });

  if (company?.mainLicenseNumber) {
    const matched = await prisma.license.findFirst({
      where: {
        companyId,
        investorId: null,
        isMainLicense: true,
        licenseNumber: company.mainLicenseNumber,
      },
      select: { id: true },
    });

    if (matched) {
      return matched.id;
    }
  }

  const fallback = await prisma.license.findFirst({
    where: {
      companyId,
      investorId: null,
      isMainLicense: true,
    },
    orderBy: [{ createdAt: "asc" }, { commercialNameAr: "asc" }],
    select: { id: true },
  });

  return fallback?.id ?? null;
}

async function resolveLicenseBranchForCreate(input: z.infer<typeof licenseSchema>) {
  if (input.isMainLicense) {
    const defaultMainLicenseId = input.investorId
      ? await findDefaultCompanyMainLicenseId(input.companyId)
      : null;

    return {
      branchId: null as string | null,
      mainLicenseId: defaultMainLicenseId,
    };
  }

  if (!input.mainLicenseId) {
    throw new Error("يجب اختيار الترخيص الرئيسي");
  }

  const parentLicense = await prisma.license.findFirst({
    where: {
      id: input.mainLicenseId,
      companyId: input.companyId,
      isMainLicense: true,
    },
    select: { id: true },
  });

  if (!parentLicense) {
    throw new Error("الترخيص الرئيسي غير صالح");
  }

  return {
    branchId: null as string | null,
    mainLicenseId: parentLicense.id,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const branchId = searchParams.get("branchId");
  // groupWide=true: تراخيص شركات المجموعة الأخرى (للإداريين العابرين)
  const groupWide = searchParams.get("groupWide") === "true";
  const excludeCompanyId = searchParams.get("excludeCompanyId");

  if (!companyId && !groupWide) {
    return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
  }

  // ── وضع groupWide: تراخيص جميع الشركات المتاحة للمستخدم ما عدا companyId المستثناة ──
  if (groupWide) {
    const accessibleIds = session.isSuperAdmin
      ? (await prisma.company.findMany({ select: { id: true } })).map((c) => c.id)
      : getAccessibleCompanyIds(session);

    const targetIds = excludeCompanyId
      ? accessibleIds.filter((id) => id !== excludeCompanyId)
      : accessibleIds;

    const data = await prisma.license.findMany({
      where: { companyId: { in: targetIds } },
      select: {
        id: true,
        companyId: true,
        commercialNameAr: true,
        commercialNameEn: true,
        licenseNumber: true,
        unifiedEntityNumber: true,
        isMainLicense: true,
        status: true,
        company: { select: { nameAr: true } },
      },
      orderBy: [{ companyId: "asc" }, { isMainLicense: "desc" }, { commercialNameAr: "asc" }],
    });
    return NextResponse.json({ success: true, data });
  }

  // ── وضع عادي: تراخيص شركة واحدة ──
  const companyAccessError = assertCompanyAccess(session, companyId!);
  if (companyAccessError) return companyAccessError;
  const permissionError = assertPermission(session, "LICENSES", "VIEW", {
    companyId: companyId!,
    branchId: branchId ?? undefined,
  });
  if (permissionError) return permissionError;

  const data = await prisma.license.findMany({
    where: {
      companyId: companyId!,
      ...(branchId ? { branchId } : {}),
    },
    include: {
      branch: { select: { id: true, nameAr: true, nameEn: true } },
      investor: { select: { id: true, nameAr: true, nameEn: true } },
      mainLicense: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
      _count: { select: { employees: true, branchLicenses: true } },
    },
    orderBy: [{ isMainLicense: "desc" }, { licenseExpiryDate: "asc" }, { commercialNameAr: "asc" }],
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = licenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data = parsed.data;
  let derivedBranchId: string | null = null;
  let derivedMainLicenseId: string | null = data.isMainLicense ? null : (data.mainLicenseId ?? null);

  try {
    const resolved = await resolveLicenseBranchForCreate(data);
    derivedBranchId = resolved.branchId;
    derivedMainLicenseId = resolved.mainLicenseId;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "بيانات الترخيص غير صالحة" },
      { status: 400 },
    );
  }

  const companyAccessError = assertCompanyAccess(session, data.companyId);
  if (companyAccessError) return companyAccessError;
  const permissionError = assertPermission(session, "LICENSES", "CREATE", {
    companyId: data.companyId,
    branchId: derivedBranchId ?? undefined,
  });
  if (permissionError) return permissionError;

  const duplicate = await prisma.license.findFirst({
    where: {
      companyId: data.companyId,
      licenseNumber: data.licenseNumber,
    },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ success: false, error: "رقم الترخيص مسجل بالفعل داخل الشركة" }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const address = data.address ? await tx.licenseAddress.create({ data: data.address }) : null;

    return tx.license.create({
      data: {
        companyId: data.companyId,
        branchId: derivedBranchId,
        investorId: data.investorId,
        licenseAddressId: address?.id,
        licenseNumber: data.licenseNumber,
        issueDate: data.issueDate,
        unifiedEntityNumber: data.unifiedEntityNumber,
        civilEntityNumber: data.civilEntityNumber,
        fileNumber: data.fileNumber,
        licenseExpiryDate: data.licenseExpiryDate,
        commercialNameAr: data.commercialNameAr,
        commercialNameEn: data.commercialNameEn,
        isMainLicense: data.isMainLicense,
        mainLicenseId: derivedMainLicenseId,
        ownerOrInvestorNameAr: data.ownerOrInvestorNameAr,
        ownerOrInvestorNameEn: data.ownerOrInvestorNameEn,
        ownerOrInvestorPhone: data.ownerOrInvestorPhone,
        investmentAmount: data.investmentAmount,
        investmentCycle: data.investmentCycle,
        rentAmount: data.rentAmount,
        rentCycle: data.rentCycle,
        totalInvestmentAmount: data.totalInvestmentAmount,
        totalInvestmentCycle: data.totalInvestmentCycle,
        investmentRenewalDate: data.investmentRenewalDate,
        managerName: data.managerName,
        managerPhone: data.managerPhone,
        legalEntity: data.legalEntity,
        capital: data.capital,
        commercialRegNo: data.commercialRegNo,
        fireLicenseExpiryDate: data.fireLicenseExpiryDate,
        healthLicenseExpiryDate: data.healthLicenseExpiryDate,
        advertisingLicenseExpiryDate: data.advertisingLicenseExpiryDate,
        status: data.status,
        notes: data.notes,
      },
      include: {
        address: true,
        branch: { select: { nameAr: true, nameEn: true } },
        investor: { select: { nameAr: true, nameEn: true } },
      },
    });
  });

  // ننشئ الإشعار فقط لو الترخيص ينتهي خلال 90 يوم أو أقل
  if (created.licenseExpiryDate) {
    const daysLeft = Math.ceil((created.licenseExpiryDate.getTime() - Date.now()) / 864e5);
    if (daysLeft <= 90) {
      await upsertNotification({
        type: "COMMERCIAL_LICENSE_EXPIRY",
        uniqueKey: `license:${created.id}:commercial:${created.licenseExpiryDate.toISOString().slice(0, 10)}`,
        titleAr: daysLeft <= 0 ? "انتهى الترخيص التجاري" : "تنبيه انتهاء الترخيص التجاري",
        titleEn: daysLeft <= 0 ? "Commercial license expired" : "Commercial license expiry alert",
        messageAr: daysLeft <= 0
          ? `انتهى الترخيص التجاري لـ ${created.commercialNameAr} — يرجى التجديد`
          : `الترخيص التجاري لـ ${created.commercialNameAr} ينتهي خلال ${daysLeft} يوم`,
        messageEn: daysLeft <= 0
          ? `Commercial license for ${created.commercialNameEn ?? created.commercialNameAr} has expired`
          : `Commercial license for ${created.commercialNameEn ?? created.commercialNameAr} expires in ${daysLeft} day(s)`,
        entityType: "LICENSE",
        entityId: created.id,
        companyId: created.companyId,
        branchId: created.branchId ?? undefined,
        investorId: created.investorId ?? undefined,
        licenseId: created.id,
        dueDate: created.licenseExpiryDate,
        severity: daysLeft <= 0 ? "DANGER" : daysLeft <= 30 ? "DANGER" : "WARNING",
        targetRole: "ADMINISTRATIVE_AFFAIRS",
        refModule: "licenses",
        refId: created.id,
      });
    }
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
