import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPE_DISPLAY, parseEnum, normalizeLookupValue,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";
import type { EmployeeType } from "@prisma/client";

const COLS: ColDef[] = [
  { header: "الاسم بالعربية *",       key: "nameAr",              required: true,  width: 25, example: "محمد أحمد علي" },
  { header: "الاسم بالإنجليزية",      key: "nameEn",              width: 25, example: "Mohammed Ahmed" },
  { header: "نوع الموظف *",           key: "type",                required: true,  width: 18, example: "موظف إداري" },
  { header: "الجنسية",                key: "nationality",         width: 15, example: "مصري" },
  { header: "رقم الهوية المدنية",     key: "civilId",             width: 15, example: "287654321098" },
  { header: "رقم جواز السفر",         key: "passportNumber",      width: 18, example: "A1234567" },
  { header: "تاريخ انتهاء الجواز",    key: "passportExpiryDate",  width: 18, example: "31/12/2028" },
  { header: "رقم الإقامة",            key: "residencyNumber",     width: 18, example: "123456789012" },
  { header: "تاريخ انتهاء الإقامة",   key: "residencyExpiry",     width: 18, example: "15/06/2026" },
  { header: "رقم رخصة القيادة",       key: "licenseNumber",       width: 18, example: "KW-123456" },
  { header: "تاريخ انتهاء الرخصة",    key: "licenseExpiry",       width: 18, example: "01/01/2027" },
  { header: "الهاتف",                 key: "phone",               width: 14, example: "65001234" },
  { header: "المسمى الوظيفي",         key: "jobTitle",            width: 20, example: "مدير إداري" },
  { header: "الراتب الأساسي",         key: "baseSalary",          width: 14, example: "120.000" },
  { header: "الراتب الفعلي",          key: "actualSalary",        width: 14, example: "370.000" },
  { header: "تاريخ الالتحاق",         key: "joinDate",            width: 16, example: "01/09/2023" },
  { header: "رقم الحساب البنكي",      key: "bankAccountNumber",   width: 20, example: "KW12NBOK0000000000001234567890" },
  { header: "الفرع",                  key: "branchName",          width: 20, example: "الفرع الرئيسي" },
  { header: "ملاحظات",                key: "notes",               width: 30, example: "" },
];

const EMPLOYEE_TYPES = ["DRIVER","DELIVERY_DRIVER","DELIVERY_ADMIN","CAR_WASH_DRIVER","CAR_WASH_WORKER","OFFICE_EMPLOYEE","ACCOUNTANT","MANDOUB","OFFICE_BOY","OTHER"] as EmployeeType[];

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template"; // template | export

  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const employees = await prisma.employee.findMany({
      where: { companyId, isActive: true, isDeleted: false },
      include: { branch: { select: { nameAr: true } } },
      orderBy: { nameAr: "asc" },
    });
    rows = employees.map((e) => ({
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
      actualSalary: e.actualSalary ? Number(e.actualSalary) : "",
      joinDate: formatDateForExcel(e.joinDate),
      bankAccountNumber: e.bankAccountNumber ?? "",
      branchName: e.branch?.nameAr ?? "",
      notes: e.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "الموظفون", mode === "template");
  const filename = mode === "export" ? "employees-export.xlsx" : "employees-template.xlsx";

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
    return NextResponse.json({ success: false, errors: requiredErrors } satisfies { success: false; errors: typeof requiredErrors });
  }

  // Fetch branches for lookup
  const branches = await prisma.branch.findMany({ where: { companyId, isActive: true }, select: { id: true, nameAr: true } });
  const branchMap = Object.fromEntries(branches.map((b) => [normalizeLookupValue(b.nameAr), b.id]));

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    const employeeType = parseEnum(data.type, EMPLOYEE_TYPE_LABELS, EMPLOYEE_TYPES);
    if (!employeeType) {
      result.errors.push({ row: rowIndex, field: "نوع الموظف", message: `الصف ${rowIndex}: نوع الموظف "${data.type}" غير صحيح. القيم المقبولة: ${Object.keys(EMPLOYEE_TYPE_LABELS).filter(k => !k.includes("_")).join("، ")}` });
      continue;
    }

    const branchId = data.branchName ? (branchMap[normalizeLookupValue(data.branchName)] ?? null) : null;
    if (data.branchName && !branchId) {
      result.errors.push({ row: rowIndex, field: "الفرع", message: `الصف ${rowIndex}: الفرع "${data.branchName}" غير موجود` });
      continue;
    }

    const payload = {
      companyId,
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
      actualSalary: data.actualSalary ? Number(data.actualSalary) : null,
      joinDate: parseDate(data.joinDate),
      bankAccountNumber: data.bankAccountNumber || null,
      notes: data.notes || null,
    };

    try {
      // Upsert by civilId if provided
      if (data.civilId) {
        const existing = await prisma.employee.findFirst({ where: { companyId, civilId: data.civilId, isDeleted: false } });
        if (existing) {
          await prisma.employee.update({ where: { id: existing.id }, data: payload });
          result.updated++;
          continue;
        }
      }
      await prisma.employee.create({ data: payload });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
