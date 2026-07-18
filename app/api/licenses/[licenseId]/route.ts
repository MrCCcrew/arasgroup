import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess, assertPermission } from "@/lib/auth/access";
import { upsertNotification } from "@/lib/notifications";
import { z } from "zod";

interface Props {
  params: Promise<{ licenseId: string }>;
}

const updateSchema = z.object({
  branchId: z.string().optional().nullable(),
  investorId: z.string().optional().nullable(),
  licenseNumber: z.string().min(1).optional(),
  issueDate: z.string().optional().nullable(),
  unifiedEntityNumber: z.string().optional().nullable(),
  civilEntityNumber: z.string().optional().nullable(),
  fileNumber: z.string().optional().nullable(),
  licenseExpiryDate: z.string().optional().nullable(),
  commercialNameAr: z.string().min(2).optional(),
  commercialNameEn: z.string().optional().nullable(),
  isMainLicense: z.boolean().optional(),
  mainLicenseId: z.string().optional().nullable(),
  ownerOrInvestorNameAr: z.string().optional().nullable(),
  ownerOrInvestorNameEn: z.string().optional().nullable(),
  ownerOrInvestorPhone: z.string().optional().nullable(),
  managerName: z.string().optional().nullable(),
  managerCivilId: z.string().optional().nullable(),
  managerPhone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.object({
    automaticNumber: z.string().optional().nullable(),
    governorate: z.string().optional().nullable(),
    area: z.string().optional().nullable(),
    block: z.string().optional().nullable(),
    street: z.string().optional().nullable(),
    plot: z.string().optional().nullable(),
    unitNumber: z.string().optional().nullable(),
  }).optional().nullable(),
  fireLicenseExpiryDate: z.string().optional().nullable(),
  healthLicenseExpiryDate: z.string().optional().nullable(),
  advertisingLicenseExpiryDate: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  legalEntity: z.string().optional().nullable(),
  capital: z.number().optional().nullable(),
  commercialRegNo: z.string().optional().nullable(),
});

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === null) return null;
  if (!v) return undefined;
  return new Date(v);
}

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

    if (matched) return matched.id;
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

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;

    // Fetch first to get companyId for access check
    const license = await prisma.license.findUnique({
      where: { id: licenseId },
      include: {
        branch: { select: { nameAr: true } },
        investor: { select: { nameAr: true } },
        address: true,
        mainLicense: { select: { id: true, commercialNameAr: true, licenseNumber: true, status: true } },
        branchLicenses: {
          include: {
            branch: { select: { nameAr: true } },
            investor: { select: { nameAr: true } },
            _count: { select: { employees: true } },
          },
          orderBy: { commercialNameAr: "asc" },
        },
        employees: {
          where: { isDeleted: false },
          select: {
            id: true,
            nameAr: true,
            type: true,
            employmentStatus: true,
            nationality: true,
            civilId: true,
          },
          orderBy: { nameAr: "asc" },
        },
        _count: { select: { employees: true, branchLicenses: true } },
      },
    });

    if (!license) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, license.companyId);
    if (companyError) return companyError;

    return NextResponse.json({ success: true, data: license });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب الترخيص" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;

    const existing = await prisma.license.findUnique({
      where: { id: licenseId },
      select: { companyId: true, branchId: true, investorId: true, isMainLicense: true, mainLicenseId: true, licenseAddressId: true },
    });
    if (!existing) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, existing.companyId);
    if (companyError) return companyError;
    const permError = assertPermission(session, "LICENSES", "UPDATE", { companyId: existing.companyId });
    if (permError) return permError;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const d = parsed.data;
    const nextInvestorId = d.investorId !== undefined ? d.investorId : existing.investorId;
    const nextIsMainLicense = d.isMainLicense ?? existing.isMainLicense;
    let nextMainLicenseId = existing.mainLicenseId;

    if (nextIsMainLicense) {
      nextMainLicenseId = nextInvestorId
        ? await findDefaultCompanyMainLicenseId(existing.companyId)
        : null;
    } else {
      const requestedParentLicenseId = d.mainLicenseId !== undefined ? d.mainLicenseId : existing.mainLicenseId;
      if (!requestedParentLicenseId) {
        return NextResponse.json({ success: false, error: "يجب اختيار الترخيص الرئيسي" }, { status: 400 });
      }

      const parentLicense = await prisma.license.findFirst({
        where: {
          id: requestedParentLicenseId,
          companyId: existing.companyId,
          isMainLicense: true,
          NOT: { id: licenseId },
        },
        select: { id: true },
      });

      if (!parentLicense) {
        return NextResponse.json({ success: false, error: "الترخيص الرئيسي غير صالح" }, { status: 400 });
      }

      nextMainLicenseId = parentLicense.id;
    }

    // تحديث أو إنشاء العنوان
    let addressId = existing.licenseAddressId;
    if (d.address) {
      const hasAddressData = Object.values(d.address).some((v) => v !== null && v !== undefined && v !== "");

      if (hasAddressData) {
        if (addressId) {
          // تحديث العنوان الموجود
          await prisma.licenseAddress.update({
            where: { id: addressId },
            data: {
              ...(d.address.automaticNumber !== undefined ? { automaticNumber: d.address.automaticNumber } : {}),
              ...(d.address.governorate !== undefined ? { governorate: d.address.governorate } : {}),
              ...(d.address.area !== undefined ? { area: d.address.area } : {}),
              ...(d.address.block !== undefined ? { block: d.address.block } : {}),
              ...(d.address.street !== undefined ? { street: d.address.street } : {}),
              ...(d.address.plot !== undefined ? { plot: d.address.plot } : {}),
              ...(d.address.unitNumber !== undefined ? { unitNumber: d.address.unitNumber } : {}),
            },
          });
        } else {
          // إنشاء عنوان جديد
          const newAddress = await prisma.licenseAddress.create({
            data: {
              automaticNumber: d.address.automaticNumber || null,
              governorate: d.address.governorate || null,
              area: d.address.area || null,
              block: d.address.block || null,
              street: d.address.street || null,
              plot: d.address.plot || null,
              unitNumber: d.address.unitNumber || null,
            },
          });
          addressId = newAddress.id;
        }
      }
    }

    const license = await prisma.license.update({
      where: { id: licenseId },
      data: {
        ...(d.investorId !== undefined ? { investorId: d.investorId } : {}),
        ...(d.licenseNumber ? { licenseNumber: d.licenseNumber } : {}),
        ...(d.commercialNameAr ? { commercialNameAr: d.commercialNameAr } : {}),
        ...(d.commercialNameEn !== undefined ? { commercialNameEn: d.commercialNameEn } : {}),
        ...(d.isMainLicense !== undefined ? { isMainLicense: d.isMainLicense } : {}),
        ...(d.mainLicenseId !== undefined || d.isMainLicense !== undefined || d.investorId !== undefined || existing.mainLicenseId !== nextMainLicenseId
          ? { mainLicenseId: nextMainLicenseId }
          : {}),
        ...(d.status ? { status: d.status } : {}),
        ...(d.notes !== undefined ? { notes: d.notes } : {}),
        ...(d.unifiedEntityNumber !== undefined ? { unifiedEntityNumber: d.unifiedEntityNumber } : {}),
        ...(d.civilEntityNumber !== undefined ? { civilEntityNumber: d.civilEntityNumber } : {}),
        ...(d.fileNumber !== undefined ? { fileNumber: d.fileNumber } : {}),
        ...(d.ownerOrInvestorNameAr !== undefined ? { ownerOrInvestorNameAr: d.ownerOrInvestorNameAr } : {}),
        ...(d.ownerOrInvestorNameEn !== undefined ? { ownerOrInvestorNameEn: d.ownerOrInvestorNameEn } : {}),
        ...(d.ownerOrInvestorPhone !== undefined ? { ownerOrInvestorPhone: d.ownerOrInvestorPhone } : {}),
        ...(d.managerName !== undefined ? { managerName: d.managerName } : {}),
        ...(d.managerCivilId !== undefined ? { managerCivilId: d.managerCivilId } : {}),
        ...(d.managerPhone !== undefined ? { managerPhone: d.managerPhone } : {}),
        ...(d.email !== undefined ? { email: d.email } : {}),
        ...(addressId !== existing.licenseAddressId ? { licenseAddressId: addressId } : {}),
        ...(d.issueDate !== undefined ? { issueDate: toDate(d.issueDate) } : {}),
        ...(d.licenseExpiryDate !== undefined ? { licenseExpiryDate: toDate(d.licenseExpiryDate) } : {}),
        ...(d.fireLicenseExpiryDate !== undefined ? { fireLicenseExpiryDate: toDate(d.fireLicenseExpiryDate) } : {}),
        ...(d.healthLicenseExpiryDate !== undefined ? { healthLicenseExpiryDate: toDate(d.healthLicenseExpiryDate) } : {}),
        ...(d.advertisingLicenseExpiryDate !== undefined ? { advertisingLicenseExpiryDate: toDate(d.advertisingLicenseExpiryDate) } : {}),
        ...(d.legalEntity !== undefined ? { legalEntity: d.legalEntity } : {}),
        ...(d.capital !== undefined ? { capital: d.capital } : {}),
        ...(d.commercialRegNo !== undefined ? { commercialRegNo: d.commercialRegNo } : {}),
      },
      include: {
        branch: { select: { nameAr: true } },
        investor: { select: { nameAr: true } },
        _count: { select: { employees: true } },
      },
    });

    // إدارة إشعار انتهاء الترخيص بعد التحديث
    if (license.licenseExpiryDate) {
      const daysLeft = Math.ceil((license.licenseExpiryDate.getTime() - Date.now()) / 864e5);
      const uniqueKey = `license:${licenseId}:commercial:${license.licenseExpiryDate.toISOString().slice(0, 10)}`;

      if (daysLeft <= 90) {
        // ضمن نطاق التنبيه → إنشاء أو تحديث الإشعار
        await upsertNotification({
          type: "COMMERCIAL_LICENSE_EXPIRY",
          uniqueKey,
          titleAr: daysLeft <= 0 ? "انتهى الترخيص التجاري" : "تنبيه انتهاء الترخيص التجاري",
          titleEn: daysLeft <= 0 ? "Commercial license expired" : "Commercial license expiry alert",
          messageAr: daysLeft <= 0
            ? `انتهى الترخيص التجاري لـ ${license.commercialNameAr} — يرجى التجديد`
            : `الترخيص التجاري لـ ${license.commercialNameAr} ينتهي خلال ${daysLeft} يوم`,
          messageEn: daysLeft <= 0
            ? `Commercial license for ${license.commercialNameEn ?? license.commercialNameAr} has expired`
            : `Commercial license for ${license.commercialNameEn ?? license.commercialNameAr} expires in ${daysLeft} day(s)`,
          entityType: "LICENSE",
          entityId: licenseId,
          companyId: existing.companyId,
          licenseId,
          dueDate: license.licenseExpiryDate,
          severity: daysLeft <= 30 ? "DANGER" : "WARNING",
          targetRole: "ADMINISTRATIVE_AFFAIRS",
          refModule: "licenses",
          refId: licenseId,
        });
      } else {
        // خارج نطاق التنبيه (أكثر من 90 يوم) → احذف الإشعار القديم إن وُجد
        await prisma.notification.deleteMany({
          where: {
            entityType: "LICENSE",
            entityId: licenseId,
            type: "COMMERCIAL_LICENSE_EXPIRY",
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: license });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث الترخيص";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { licenseId } = await params;

    const existing = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!existing) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });

    const companyError = assertCompanyAccess(session, existing.companyId);
    if (companyError) return companyError;
    const permError = assertPermission(session, "LICENSES", "DELETE", { companyId: existing.companyId });
    if (permError) return permError;

    const employeeCount = await prisma.employee.count({ where: { licenseId, isDeleted: false } });
    if (employeeCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الترخيص — مرتبط بـ ${employeeCount} موظف` },
        { status: 400 }
      );
    }

    await prisma.license.delete({ where: { id: licenseId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الترخيص";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
