import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  normalizeLookupValue, normalizeLicenseNumber,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";

// licenseType: owner-main | owner-sub | investor-main | investor-sub | investor-combined

const BASE_COLS: ColDef[] = [
  { header: "رقم الترخيص *",              key: "licenseNumber",              required: true,  width: 18, example: "123456/2024" },
  { header: "الاسم التجاري بالعربية *",   key: "commercialNameAr",           required: true,  width: 28, example: "مطعم الأصالة" },
  { header: "الاسم التجاري بالإنجليزية", key: "commercialNameEn",            width: 28, example: "Al-Asala Restaurant" },
  { header: "الفرع",                       key: "branchName",                 width: 22, example: "الفرع الرئيسي" },
  { header: "تاريخ الإصدار",              key: "issueDate",                  width: 16, example: "01/01/2024" },
  { header: "تاريخ الانتهاء",             key: "licenseExpiryDate",          width: 16, example: "31/12/2025" },
  { header: "الرقم الموحد",               key: "unifiedEntityNumber",        width: 20, example: "123456789" },
  { header: "رقم الجهة المدني",           key: "civilEntityNumber",          width: 20, example: "987654321" },
  { header: "رقم الملف",                  key: "fileNumber",                 width: 16, example: "F-12345" },
  { header: "الشكل القانوني",             key: "legalEntity",                width: 20, example: "مؤسسة فردية" },
  { header: "رأس المال",                  key: "capital",                    width: 14, example: "5000.000" },
  { header: "رقم السجل التجاري",          key: "commercialRegNo",            width: 20, example: "CR-123456" },
  { header: "اسم صاحب الترخيص",          key: "ownerOrInvestorNameAr",      width: 25, example: "محمد علي الكندي" },
  { header: "هاتف صاحب الترخيص",         key: "ownerOrInvestorPhone",       width: 14, example: "99001234" },
  { header: "اسم المدير",                 key: "managerName",                width: 20, example: "سعد محمد" },
  { header: "الرقم المدني للمفوض بالتوقيع", key: "managerCivilId",           width: 22, example: "123456789012" },
  { header: "هاتف المدير",                key: "managerPhone",               width: 14, example: "65001234" },
  { header: "الايميل",                    key: "email",                      width: 25, example: "info@example.com" },
  { header: "الرقم الآلي للعنوان",        key: "automaticNumber",            width: 18, example: "12345" },
  { header: "المحافظة",                   key: "governorate",                width: 16, example: "حولي" },
  { header: "المنطقة",                    key: "area",                       width: 16, example: "السالمية" },
  { header: "القطعة",                     key: "block",                      width: 12, example: "5" },
  { header: "الشارع",                     key: "street",                     width: 16, example: "شارع 10" },
  { header: "القسيمة",                    key: "plot",                       width: 12, example: "123" },
  { header: "الوحدة",                     key: "unitNumber",                 width: 12, example: "A12" },
  { header: "قيمة الإيجار",              key: "rentAmount",                 width: 14, example: "500.000" },
  { header: "دورة الإيجار",              key: "rentCycle",                  width: 14, example: "شهري" },
  { header: "قيمة الاستثمار",            key: "investmentAmount",           width: 14, example: "1000.000" },
  { header: "دورة الاستثمار",            key: "investmentCycle",            width: 14, example: "شهري" },
  { header: "تاريخ تجديد الاستثمار",     key: "investmentRenewalDate",      width: 18, example: "01/01/2026" },
  { header: "انتهاء ترخيص الإطفاء",      key: "fireLicenseExpiryDate",      width: 18, example: "30/06/2025" },
  { header: "انتهاء الترخيص الصحي",      key: "healthLicenseExpiryDate",    width: 18, example: "30/06/2025" },
  { header: "انتهاء ترخيص الإعلانات",    key: "advertisingLicenseExpiryDate", width: 18, example: "30/06/2025" },
  { header: "انتهاء شهادة المرور",        key: "trafficCertExpiryDate",      width: 18, example: "30/06/2025" },
  { header: "انتهاء شهادة الجمارك",       key: "customsCertExpiryDate",      width: 18, example: "30/06/2025" },
  { header: "انتهاء ترخيص الاستيراد",    key: "importLicenseExpiryDate",    width: 18, example: "30/06/2025" },
  { header: "ملاحظات",                    key: "notes",                      width: 35, example: "" },
];

const INVESTOR_COL: ColDef = {
  header: "اسم المسئول / المدير *", key: "investorName", required: true, width: 25, example: "عبدالله العجمي",
};

const MAIN_LICENSE_COL: ColDef = {
  header: "رقم الترخيص الرئيسي *", key: "mainLicenseNumber", required: true, width: 20, example: "123456/2024",
};
const COMBINED_MAIN_LICENSE_COL: ColDef = { ...MAIN_LICENSE_COL, header: "رقم الترخيص الرئيسي", required: false };

function getCols(licenseType: string): ColDef[] {
  if (licenseType === "investor-combined") return [INVESTOR_COL, COMBINED_MAIN_LICENSE_COL, ...BASE_COLS];
  if (licenseType === "investor-main") return [INVESTOR_COL, ...BASE_COLS];
  if (licenseType === "investor-sub")  return [INVESTOR_COL, MAIN_LICENSE_COL, ...BASE_COLS];
  if (licenseType === "owner-sub")     return [MAIN_LICENSE_COL, ...BASE_COLS];
  return BASE_COLS; // owner-main
}

function getSheetName(licenseType: string): string {
  const map: Record<string, string> = {
    "owner-main":    "تراخيص المالك الرئيسية",
    "owner-sub":     "تراخيص المالك الفرعية",
    "investor-main": "تراخيص المسئولين الرئيسية",
    "investor-sub":  "تراخيص المسئولين الفرعية",
    "investor-combined": "تراخيص المسئولين الرئيسية والفرعية",
  };
  return map[licenseType] ?? "التراخيص";
}

function rowToLicense(data: Record<string, string>) {
  return {
    licenseNumber:                data.licenseNumber,
    commercialNameAr:             data.commercialNameAr,
    commercialNameEn:             data.commercialNameEn || null,
    issueDate:                    parseDate(data.issueDate),
    licenseExpiryDate:            parseDate(data.licenseExpiryDate),
    unifiedEntityNumber:          data.unifiedEntityNumber || null,
    civilEntityNumber:            data.civilEntityNumber || null,
    fileNumber:                   data.fileNumber || null,
    legalEntity:                  data.legalEntity || null,
    capital:                      data.capital ? Number(data.capital) : null,
    commercialRegNo:              data.commercialRegNo || null,
    ownerOrInvestorNameAr:        data.ownerOrInvestorNameAr || null,
    ownerOrInvestorPhone:         data.ownerOrInvestorPhone || null,
    managerName:                  data.managerName || null,
    managerCivilId:               data.managerCivilId || null,
    managerPhone:                 data.managerPhone || null,
    email:                        data.email || null,
    address: {
      automaticNumber: data.automaticNumber || null,
      governorate:     data.governorate || null,
      area:            data.area || null,
      block:           data.block || null,
      street:          data.street || null,
      plot:            data.plot || null,
      unitNumber:      data.unitNumber || null,
    },
    rentAmount:                   data.rentAmount ? Number(data.rentAmount) : null,
    rentCycle:                    data.rentCycle || null,
    investmentAmount:             data.investmentAmount ? Number(data.investmentAmount) : null,
    investmentCycle:              data.investmentCycle || null,
    investmentRenewalDate:        parseDate(data.investmentRenewalDate),
    fireLicenseExpiryDate:        parseDate(data.fireLicenseExpiryDate),
    healthLicenseExpiryDate:      parseDate(data.healthLicenseExpiryDate),
    advertisingLicenseExpiryDate: parseDate(data.advertisingLicenseExpiryDate),
    trafficCertExpiryDate:        parseDate(data.trafficCertExpiryDate),
    customsCertExpiryDate:        parseDate(data.customsCertExpiryDate),
    importLicenseExpiryDate:      parseDate(data.importLicenseExpiryDate),
    notes:                        data.notes || null,
  };
}

function licenseToRow(lic: Record<string, unknown>): Record<string, unknown> {
  return {
    licenseNumber:                lic.licenseNumber,
    commercialNameAr:             lic.commercialNameAr,
    commercialNameEn:             lic.commercialNameEn ?? "",
    branchName:                   (lic as { branch?: { nameAr?: string } }).branch?.nameAr ?? "",
    issueDate:                    formatDateForExcel(lic.issueDate as Date | null),
    licenseExpiryDate:            formatDateForExcel(lic.licenseExpiryDate as Date | null),
    unifiedEntityNumber:          lic.unifiedEntityNumber ?? "",
    civilEntityNumber:            lic.civilEntityNumber ?? "",
    fileNumber:                   lic.fileNumber ?? "",
    legalEntity:                  lic.legalEntity ?? "",
    capital:                      lic.capital ? Number(lic.capital) : "",
    commercialRegNo:              lic.commercialRegNo ?? "",
    ownerOrInvestorNameAr:        lic.ownerOrInvestorNameAr ?? "",
    ownerOrInvestorPhone:         lic.ownerOrInvestorPhone ?? "",
    managerName:                  lic.managerName ?? "",
    managerCivilId:               lic.managerCivilId ?? "",
    managerPhone:                 lic.managerPhone ?? "",
    email:                        lic.email ?? "",
    automaticNumber:              (lic as { address?: { automaticNumber?: string | null } }).address?.automaticNumber ?? "",
    governorate:                  (lic as { address?: { governorate?: string | null } }).address?.governorate ?? "",
    area:                         (lic as { address?: { area?: string | null } }).address?.area ?? "",
    block:                        (lic as { address?: { block?: string | null } }).address?.block ?? "",
    street:                       (lic as { address?: { street?: string | null } }).address?.street ?? "",
    plot:                         (lic as { address?: { plot?: string | null } }).address?.plot ?? "",
    unitNumber:                   (lic as { address?: { unitNumber?: string | null } }).address?.unitNumber ?? "",
    rentAmount:                   lic.rentAmount ? Number(lic.rentAmount) : "",
    rentCycle:                    lic.rentCycle ?? "",
    investmentAmount:             lic.investmentAmount ? Number(lic.investmentAmount) : "",
    investmentCycle:              lic.investmentCycle ?? "",
    investmentRenewalDate:        formatDateForExcel(lic.investmentRenewalDate as Date | null),
    fireLicenseExpiryDate:        formatDateForExcel(lic.fireLicenseExpiryDate as Date | null),
    healthLicenseExpiryDate:      formatDateForExcel(lic.healthLicenseExpiryDate as Date | null),
    advertisingLicenseExpiryDate: formatDateForExcel(lic.advertisingLicenseExpiryDate as Date | null),
    trafficCertExpiryDate:        formatDateForExcel(lic.trafficCertExpiryDate as Date | null),
    customsCertExpiryDate:        formatDateForExcel(lic.customsCertExpiryDate as Date | null),
    importLicenseExpiryDate:      formatDateForExcel(lic.importLicenseExpiryDate as Date | null),
    notes:                        lic.notes ?? "",
  };
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

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId   = searchParams.get("companyId");
  const licenseType = searchParams.get("licenseType") ?? "owner-main";
  const mode        = searchParams.get("mode") ?? "template";
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const cols = getCols(licenseType);
  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const isCombinedInvestor = licenseType === "investor-combined";
    const isMain     = licenseType.endsWith("main");
    const isInvestor = licenseType.startsWith("investor");

    const licenses = await prisma.license.findMany({
      where: {
        companyId,
        ...(isCombinedInvestor ? {} : { isMainLicense: isMain }),
        investorId: isInvestor ? { not: null } : null,
      },
      include: {
        branch:   { select: { nameAr: true } },
        investor: { select: { nameAr: true } },
        mainLicense: { select: { licenseNumber: true } },
        address: true,
      },
      orderBy: isCombinedInvestor
        ? [{ isMainLicense: "desc" }, { commercialNameAr: "asc" }]
        : { commercialNameAr: "asc" },
    });

    rows = licenses.map((lic) => {
      const row = licenseToRow(lic as unknown as Record<string, unknown>);
      if (isInvestor) row.investorName = lic.investor?.nameAr ?? "";
      if (isCombinedInvestor) {
        row.mainLicenseNumber = lic.isMainLicense
          ? lic.licenseNumber
          : (lic.mainLicense?.licenseNumber ?? "");
      } else if (!isMain) {
        row.mainLicenseNumber = lic.mainLicense?.licenseNumber ?? "";
      }
      return row;
    });
  }

  const buf = buildWorkbook(cols, rows, getSheetName(licenseType), mode === "template");
  const filename = `licenses-${licenseType}-${mode}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId   = searchParams.get("companyId");
  const licenseType = searchParams.get("licenseType") ?? "owner-main";
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });

  const cols = getCols(licenseType);
  const buf = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buf, cols);
  if (parsedRows.length === 0) {
    return NextResponse.json({
      success: false,
      error: "لا توجد صفوف بيانات للاستيراد. أدخل البيانات بدءًا من الصف الثالث بعد العناوين وصف المثال.",
    }, { status: 400 });
  }
  const requiredErrors = validateRequired(parsedRows, cols);
  if (requiredErrors.length > 0) return NextResponse.json({ success: false, errors: requiredErrors });

  const isCombinedInvestor = licenseType === "investor-combined";
  const isMain     = licenseType.endsWith("main");
  const isInvestor = licenseType.startsWith("investor");
  const defaultCompanyMainLicenseId = (isMain && isInvestor) || isCombinedInvestor
    ? await findDefaultCompanyMainLicenseId(companyId)
    : null;

  // Pre-fetch lookups
  const branches  = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, nameAr: true } });
  const branchMap = Object.fromEntries(branches.map((b) => [normalizeLookupValue(b.nameAr), b.id]));

  const investors  = isInvestor
    ? await prisma.investor.findMany({ where: { isActive: true, companies: { some: { id: companyId } } }, select: { id: true, nameAr: true } })
    : [];
  const investorMap = Object.fromEntries(investors.map((i) => [normalizeLookupValue(i.nameAr), i.id]));
  const mainLicenses = (!isMain || isCombinedInvestor)
    ? await prisma.license.findMany({
        where: { companyId, isMainLicense: true },
        select: { id: true, investorId: true, licenseNumber: true, commercialNameAr: true, isMainLicense: true },
      })
    : [];
  const mainLicenseMap = new Map(
    mainLicenses.map((license) => [normalizeLicenseNumber(license.licenseNumber), license])
  );
  const mainLicenseByInvestorMap = new Map(
    mainLicenses
      .filter((license) => license.investorId)
      .map((license) => [`${license.investorId}:${normalizeLicenseNumber(license.licenseNumber)}`, license])
  );

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    const normalizedLicenseNumber = normalizeLicenseNumber(data.licenseNumber);
    const normalizedMainLicenseNumber = normalizeLicenseNumber(data.mainLicenseNumber);
    const rowIsMain = isCombinedInvestor
      ? !normalizedMainLicenseNumber || normalizedLicenseNumber === normalizedMainLicenseNumber
      : isMain;

    if (!rowIsMain && normalizedLicenseNumber && normalizedMainLicenseNumber && normalizedLicenseNumber === normalizedMainLicenseNumber) {
      result.errors.push({
        row: rowIndex,
        field: "رقم الترخيص",
        message: `الصف ${rowIndex}: هذا الصف يبدو ترخيصًا رئيسيًا وليس فرعيًا لأن رقم الترخيص يساوي رقم الترخيص الرئيسي`,
      });
      continue;
    }

    // Resolve branch
    const branchId = data.branchName ? (branchMap[normalizeLookupValue(data.branchName)] ?? null) : null;

    // Resolve investor
    let investorId: string | null = null;
    if (isInvestor) {
      investorId = investorMap[normalizeLookupValue(data.investorName)] ?? null;
      if (!investorId) {
        result.errors.push({ row: rowIndex, field: "اسم المسئول", message: `الصف ${rowIndex}: المسئول "${data.investorName}" غير موجود في النظام` });
        continue;
      }
    }

    // Resolve main license for sub-licenses
    let mainLicenseId: string | null = rowIsMain && isInvestor ? defaultCompanyMainLicenseId : null;
    if (!rowIsMain && data.mainLicenseNumber) {
      const mainLic = (isInvestor && investorId
        ? mainLicenseByInvestorMap.get(`${investorId}:${normalizedMainLicenseNumber}`)
        : null) ?? mainLicenseMap.get(normalizedMainLicenseNumber);
      if (!mainLic) {
        result.errors.push({ row: rowIndex, field: "رقم الترخيص الرئيسي", message: `الصف ${rowIndex}: الترخيص الرئيسي "${data.mainLicenseNumber}" غير موجود` });
        continue;
      }
      mainLicenseId = mainLic.id;
    }

    const licenseData = rowToLicense(data);
    const { address: addressData, ...licenseDataWithoutAddress } = licenseData;

    const payload = {
      companyId,
      branchId,
      investorId,
      mainLicenseId,
      isMainLicense: rowIsMain,
      ...licenseDataWithoutAddress,
    };

    try {
      const existing = await prisma.license.findFirst({
        where: { companyId, licenseNumber: data.licenseNumber },
        select: { id: true, isMainLicense: true, investorId: true, licenseAddressId: true },
      });
      if (existing) {
        const canPromoteInvestorMain =
          (licenseType === "investor-main" || isCombinedInvestor) &&
          rowIsMain &&
          !existing.isMainLicense &&
          existing.investorId === investorId;

        if (existing.isMainLicense !== rowIsMain && !canPromoteInvestorMain) {
          result.errors.push({
            row: rowIndex,
            field: "رقم الترخيص",
            message: `الصف ${rowIndex}: يوجد ترخيص بنفس الرقم لكنه مسجل كـ ${existing.isMainLicense ? "رئيسي" : "فرعي"}، لذلك لن يتم تغيير نوعه عبر الاستيراد`,
          });
          continue;
        }

        // تحديث أو إنشاء العنوان
        let addressId = existing.licenseAddressId;
        if (addressData) {
          const hasAddressData = Object.values(addressData).some((v) => v !== null && v !== undefined && v !== "");

          if (hasAddressData) {
            if (addressId) {
              await prisma.licenseAddress.update({
                where: { id: addressId },
                data: addressData as Record<string, unknown>,
              });
            } else {
              const newAddress = await prisma.licenseAddress.create({
                data: addressData as Record<string, unknown>,
              });
              addressId = newAddress.id;
            }
          }
        }

        const updated = await prisma.license.update({
          where: { id: existing.id },
          data: { ...payload, ...(addressId !== existing.licenseAddressId ? { licenseAddressId: addressId } : {}) },
        });
        if (updated.isMainLicense) {
          const mapped = {
            id: updated.id,
            investorId: updated.investorId,
            licenseNumber: updated.licenseNumber,
            commercialNameAr: updated.commercialNameAr,
            isMainLicense: updated.isMainLicense,
          };
          mainLicenseMap.set(normalizeLicenseNumber(updated.licenseNumber), mapped);
          if (updated.investorId) {
            mainLicenseByInvestorMap.set(`${updated.investorId}:${normalizeLicenseNumber(updated.licenseNumber)}`, mapped);
          }
        }
        result.updated++;
      } else {
        // إنشاء عنوان جديد إذا كان هناك بيانات
        let addressId: string | null = null;
        if (addressData) {
          const hasAddressData = Object.values(addressData).some((v) => v !== null && v !== undefined && v !== "");

          if (hasAddressData) {
            const newAddress = await prisma.licenseAddress.create({
              data: addressData as Record<string, unknown>,
            });
            addressId = newAddress.id;
          }
        }

        const created = await prisma.license.create({
          data: { ...payload, ...(addressId ? { licenseAddressId: addressId } : {}) },
        });
        if (created.isMainLicense) {
          const mapped = {
            id: created.id,
            investorId: created.investorId,
            licenseNumber: created.licenseNumber,
            commercialNameAr: created.commercialNameAr,
            isMainLicense: created.isMainLicense,
          };
          mainLicenseMap.set(normalizeLicenseNumber(created.licenseNumber), mapped);
          if (created.investorId) {
            mainLicenseByInvestorMap.set(`${created.investorId}:${normalizeLicenseNumber(created.licenseNumber)}`, mapped);
          }
        }
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
