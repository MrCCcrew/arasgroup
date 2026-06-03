import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook,
  parseWorkbook,
  validateRequired,
  parseDate,
  formatDateForExcel,
  EMPLOYEE_TYPE_LABELS,
  EMPLOYEE_TYPE_DISPLAY,
  parseEnum,
  type ColDef,
  type ImportResult,
} from "@/lib/excel/import-export";
import type { EmployeeType } from "@prisma/client";

const COLS: ColDef[] = [
  { header: "اسم المسئول *", key: "investorName", required: true, width: 25, example: "أحمد محمد" },
  { header: "الاسم بالعربية *", key: "nameAr", required: true, width: 25, example: "عبدالله أحمد" },
  { header: "الاسم بالإنجليزية", key: "nameEn", width: 25, example: "Abdullah Ahmed" },
  { header: "نوع الموظف *", key: "type", required: true, width: 18, example: "موظف إداري" },
  { header: "الجنسية", key: "nationality", width: 15, example: "مصري" },
  { header: "رقم الهوية المدنية", key: "civilId", width: 15, example: "287654321098" },
  { header: "رقم جواز السفر", key: "passportNumber", width: 18, example: "A1234567" },
  { header: "تاريخ انتهاء الجواز", key: "passportExpiryDate", width: 18, example: "31/12/2028" },
  { header: "رقم الإقامة", key: "residencyNumber", width: 18, example: "123456789012" },
  { header: "تاريخ انتهاء الإقامة", key: "residencyExpiry", width: 18, example: "15/06/2026" },
  { header: "رقم رخصة القيادة", key: "licenseNumber", width: 18, example: "KW-123456" },
  { header: "تاريخ انتهاء الرخصة", key: "licenseExpiry", width: 18, example: "01/01/2027" },
  { header: "الهاتف", key: "phone", width: 14, example: "65001234" },
  { header: "المسمى الوظيفي", key: "jobTitle", width: 20, example: "مدير إداري" },
  { header: "الراتب الأساسي", key: "baseSalary", width: 14, example: "250.000" },
  { header: "تاريخ الالتحاق", key: "joinDate", width: 16, example: "01/09/2023" },
  { header: "رقم الحساب البنكي", key: "bankAccountNumber", width: 20, example: "KW12NBOK..." },
  { header: "الترخيص", key: "licenseName", width: 30, example: "ترخيص الفرع الرئيسي" },
  { header: "الفرع", key: "branchName", width: 20, example: "الفرع الرئيسي" },
  { header: "ملاحظات", key: "notes", width: 30, example: "" },
];

const EMPLOYEE_TYPES = [
  "DRIVER",
  "DELIVERY_DRIVER",
  "DELIVERY_ADMIN",
  "CAR_WASH_DRIVER",
  "CAR_WASH_WORKER",
  "OFFICE_EMPLOYEE",
  "ACCOUNTANT",
  "MANDOUB",
  "OFFICE_BOY",
  "OTHER",
] as EmployeeType[];

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template";

  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        isDeleted: false,
        investorId: { not: null },
      },
      include: {
        investor: { select: { nameAr: true } },
        license: { select: { commercialNameAr: true } },
        branch: { select: { nameAr: true } },
      },
      orderBy: [{ investor: { nameAr: "asc" } }, { nameAr: "asc" }],
    });

    rows = employees.map((e) => ({
      investorName: e.investor?.nameAr ?? "",
      nameAr: e.nameAr,
      nameEn: e.nameEn ?? "",
      type: EMPLOYEE_TYPE_DISPLAY[e.type] ?? e.type,
      nationality: e.nationality ?? "",
      civilId: e.civilId ?? "",
      passportNumber: e.passportNumber ?? "",
      passportExpiryDate: formatDateForExcel(e.passportExpiryDate),
      residencyNumber: e.residencyNumber ?? "",
      residencyExpiry: formatDateForExcel(e.residencyExpiry),
      licenseNumber: e.licenseNumber ?? "",
      licenseExpiry: formatDateForExcel(e.licenseExpiry),
      phone: e.phone ?? "",
      jobTitle: e.jobTitle ?? "",
      baseSalary: e.baseSalary ? Number(e.baseSalary) : "",
      joinDate: formatDateForExcel(e.joinDate),
      bankAccountNumber: e.bankAccountNumber ?? "",
      licenseName: e.license?.commercialNameAr ?? "",
      branchName: e.branch?.nameAr ?? "",
      notes: e.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "موظفين المستثمرين", mode === "template");
  const filename =
    mode === "export" ? "investor-employees-export.xlsx" : "investor-employees-template.xlsx";

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
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buf, COLS);

  const requiredErrors = validateRequired(parsedRows, COLS);
  if (requiredErrors.length > 0) {
    return NextResponse.json({
      success: false,
      errors: requiredErrors,
    } satisfies { success: false; errors: typeof requiredErrors });
  }

  // Fetch lookup tables
  const [investors, licenses, branches] = await Promise.all([
    prisma.investor.findMany({ where: { isActive: true }, select: { id: true, nameAr: true } }),
    prisma.license.findMany({
      where: { companyId, status: "ACTIVE" },
      select: { id: true, commercialNameAr: true },
    }),
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      select: { id: true, nameAr: true },
    }),
  ]);

  const investorMap = Object.fromEntries(investors.map((i) => [i.nameAr.trim(), i.id]));
  const licenseMap = Object.fromEntries(licenses.map((l) => [l.commercialNameAr.trim(), l.id]));
  const branchMap = Object.fromEntries(branches.map((b) => [b.nameAr.trim(), b.id]));

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    // Validate investor
    const investorId = investorMap[data.investorName?.trim()];
    if (!investorId) {
      result.errors.push({
        row: rowIndex,
        field: "اسم المسئول",
        message: `الصف ${rowIndex}: المسئول "${data.investorName}" غير موجود`,
      });
      continue;
    }

    // Validate employee type
    const employeeType = parseEnum(data.type, EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPES);
    if (!employeeType) {
      result.errors.push({
        row: rowIndex,
        field: "نوع الموظف",
        message: `الصف ${rowIndex}: نوع الموظف "${data.type}" غير صحيح`,
      });
      continue;
    }

    // Optional lookups
    const licenseId = data.licenseName ? (licenseMap[data.licenseName] ?? null) : null;
    const branchId = data.branchName ? (branchMap[data.branchName] ?? null) : null;

    const payload = {
      companyId,
      investorId,
      licenseId,
      branchId,
      nameAr: data.nameAr,
      nameEn: data.nameEn || null,
      type: employeeType,
      nationality: data.nationality || null,
      civilId: data.civilId || null,
      passportNumber: data.passportNumber || null,
      passportExpiryDate: parseDate(data.passportExpiryDate),
      residencyNumber: data.residencyNumber || null,
      residencyExpiry: parseDate(data.residencyExpiry),
      licenseNumber: data.licenseNumber || null,
      licenseExpiry: parseDate(data.licenseExpiry),
      phone: data.phone || null,
      jobTitle: data.jobTitle || null,
      baseSalary: data.baseSalary ? Number(data.baseSalary) : null,
      joinDate: parseDate(data.joinDate),
      bankAccountNumber: data.bankAccountNumber || null,
      notes: data.notes || null,
    };

    try {
      // Upsert by civilId if provided
      if (data.civilId) {
        const existing = await prisma.employee.findFirst({
          where: { companyId, civilId: data.civilId, isDeleted: false },
        });
        if (existing) {
          await prisma.employee.update({ where: { id: existing.id }, data: payload });
          result.updated++;
          continue;
        }
      }
      await prisma.employee.create({ data: payload });
      result.created++;
    } catch (err) {
      result.errors.push({
        row: rowIndex,
        message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}`,
      });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
