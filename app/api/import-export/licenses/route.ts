import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";

// licenseType: owner-main | owner-sub | investor-main | investor-sub

const BASE_COLS: ColDef[] = [
  { header: "رقم الترخيص *",              key: "licenseNumber",              required: true,  width: 18, example: "123456/2024" },
  { header: "الاسم التجاري بالعربية *",   key: "commercialNameAr",           required: true,  width: 28, example: "مطعم الأصالة" },
  { header: "الاسم التجاري بالإنجليزية", key: "commercialNameEn",            width: 28, example: "Al-Asala Restaurant" },
  { header: "الفرع",                       key: "branchName",                 width: 22, example: "الفرع الرئيسي" },
  { header: "تاريخ الإصدار",              key: "issueDate",                  width: 16, example: "01/01/2024" },
  { header: "تاريخ الانتهاء",             key: "licenseExpiryDate",          width: 16, example: "31/12/2025" },
  { header: "رقم الوحدة الموحدة",         key: "unifiedEntityNumber",        width: 20, example: "123456789" },
  { header: "رقم الجهة المدنية",          key: "civilEntityNumber",          width: 20, example: "987654321" },
  { header: "رقم الملف",                  key: "fileNumber",                 width: 16, example: "F-12345" },
  { header: "الشكل القانوني",             key: "legalEntity",                width: 20, example: "مؤسسة فردية" },
  { header: "رأس المال",                  key: "capital",                    width: 14, example: "5000.000" },
  { header: "رقم السجل التجاري",          key: "commercialRegNo",            width: 20, example: "CR-123456" },
  { header: "اسم صاحب الترخيص",          key: "ownerOrInvestorNameAr",      width: 25, example: "محمد علي الكندي" },
  { header: "هاتف صاحب الترخيص",         key: "ownerOrInvestorPhone",       width: 14, example: "99001234" },
  { header: "اسم المدير",                 key: "managerName",                width: 20, example: "سعد محمد" },
  { header: "هاتف المدير",                key: "managerPhone",               width: 14, example: "65001234" },
  { header: "قيمة الإيجار",              key: "rentAmount",                 width: 14, example: "500.000" },
  { header: "دورة الإيجار",              key: "rentCycle",                  width: 14, example: "شهري" },
  { header: "قيمة الاستثمار",            key: "investmentAmount",           width: 14, example: "1000.000" },
  { header: "دورة الاستثمار",            key: "investmentCycle",            width: 14, example: "شهري" },
  { header: "تاريخ تجديد الاستثمار",     key: "investmentRenewalDate",      width: 18, example: "01/01/2026" },
  { header: "انتهاء ترخيص الحريق",       key: "fireLicenseExpiryDate",      width: 18, example: "30/06/2025" },
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

function getCols(licenseType: string): ColDef[] {
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
    managerPhone:                 data.managerPhone || null,
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
    managerPhone:                 lic.managerPhone ?? "",
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

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId   = searchParams.get("companyId");
  const licenseType = searchParams.get("licenseType") ?? "owner-main";
  const mode        = searchParams.get("mode") ?? "template";
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  const cols = getCols(licenseType);
  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const isMain     = licenseType.endsWith("main");
    const isInvestor = licenseType.startsWith("investor");

    const licenses = await prisma.license.findMany({
      where: {
        companyId,
        isMainLicense: isMain,
        investorId: isInvestor ? { not: null } : null,
      },
      include: {
        branch:   { select: { nameAr: true } },
        investor: { select: { nameAr: true } },
        mainLicense: { select: { licenseNumber: true } },
      },
      orderBy: { commercialNameAr: "asc" },
    });

    rows = licenses.map((lic) => {
      const row = licenseToRow(lic as unknown as Record<string, unknown>);
      if (isInvestor) row.investorName = lic.investor?.nameAr ?? "";
      if (!isMain)    row.mainLicenseNumber = lic.mainLicense?.licenseNumber ?? "";
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });

  const cols = getCols(licenseType);
  const buf = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buf, cols);
  const requiredErrors = validateRequired(parsedRows, cols);
  if (requiredErrors.length > 0) return NextResponse.json({ success: false, errors: requiredErrors });

  const isMain     = licenseType.endsWith("main");
  const isInvestor = licenseType.startsWith("investor");

  // Pre-fetch lookups
  const branches  = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, nameAr: true } });
  const branchMap = Object.fromEntries(branches.map((b) => [b.nameAr.trim(), b.id]));

  const investors  = isInvestor
    ? await prisma.investor.findMany({ where: { isActive: true }, select: { id: true, nameAr: true } })
    : [];
  const investorMap = Object.fromEntries(investors.map((i) => [i.nameAr.trim(), i.id]));

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    // Resolve branch
    const branchId = data.branchName ? (branchMap[data.branchName] ?? null) : null;
    if (data.branchName && !branchId) {
      result.errors.push({ row: rowIndex, field: "الفرع", message: `الصف ${rowIndex}: الفرع "${data.branchName}" غير موجود` });
      continue;
    }

    // Resolve investor
    let investorId: string | null = null;
    if (isInvestor) {
      investorId = investorMap[data.investorName?.trim() ?? ""] ?? null;
      if (!investorId) {
        result.errors.push({ row: rowIndex, field: "اسم المسئول", message: `الصف ${rowIndex}: المسئول "${data.investorName}" غير موجود في النظام` });
        continue;
      }
    }

    // Resolve main license for sub-licenses
    let mainLicenseId: string | null = null;
    if (!isMain && data.mainLicenseNumber) {
      const mainLic = await prisma.license.findFirst({
        where: { companyId, licenseNumber: data.mainLicenseNumber, isMainLicense: true },
      });
      if (!mainLic) {
        result.errors.push({ row: rowIndex, field: "رقم الترخيص الرئيسي", message: `الصف ${rowIndex}: الترخيص الرئيسي "${data.mainLicenseNumber}" غير موجود` });
        continue;
      }
      mainLicenseId = mainLic.id;
    }

    const payload = {
      companyId,
      branchId,
      investorId,
      mainLicenseId,
      isMainLicense: isMain,
      ...rowToLicense(data),
    };

    try {
      const existing = await prisma.license.findFirst({
        where: { companyId, licenseNumber: data.licenseNumber },
      });
      if (existing) {
        await prisma.license.update({ where: { id: existing.id }, data: payload });
        result.updated++;
      } else {
        await prisma.license.create({ data: payload });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
