import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";

const COLS: ColDef[] = [
  { header: "الاسم بالعربية *",       key: "nameAr",           required: true, width: 25, example: "خالد محمد العجمي" },
  { header: "الاسم بالإنجليزية",      key: "nameEn",           width: 25, example: "Khaled Al-Ajmi" },
  { header: "الجنسية",                key: "nationality",      width: 14, example: "كويتي" },
  { header: "رقم الهوية المدنية",     key: "civilId",          width: 15, example: "287654321098" },
  { header: "رقم الإقامة",            key: "residencyNumber",  width: 18, example: "123456789012" },
  { header: "تاريخ انتهاء الإقامة",   key: "residencyExpiry",  width: 18, example: "15/06/2026" },
  { header: "رقم جواز السفر",         key: "passportNumber",   width: 18, example: "A1234567" },
  { header: "تاريخ انتهاء الجواز",    key: "passportExpiry",   width: 18, example: "31/12/2028" },
  { header: "رقم رخصة القيادة",       key: "licenseNumber",    width: 18, example: "KW-123456" },
  { header: "تاريخ انتهاء الرخصة",    key: "licenseExpiry",    width: 18, example: "01/01/2027" },
  { header: "الهاتف",                 key: "phone",            width: 14, example: "65001234" },
  { header: "الراتب",                 key: "baseSalary",       width: 12, example: "150.000" },
  { header: "رقم Talabat",            key: "talabatId",        width: 16, example: "12345" },
  { header: "رقم RoPops",             key: "roPopsId",         width: 16, example: "RP-6789" },
  { header: "رقم كرت الوقود",         key: "fuelCardNumber",   width: 18, example: "FC-001234" },
  { header: "تاريخ الالتحاق",         key: "joinDate",         width: 16, example: "01/01/2024" },
  { header: "ملاحظات",                key: "notes",            width: 30, example: "" },
];

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template";
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const drivers = await prisma.driver.findMany({
      where: { employee: { companyId, isActive: true, isDeleted: false } },
      include: { employee: true },
    });
    rows = drivers.map((d) => ({
      nameAr: d.employee.nameAr,
      nameEn: d.employee.nameEn ?? "",
      nationality: d.employee.nationality ?? "",
      civilId: d.employee.civilId ?? "",
      residencyNumber: d.employee.residencyNumber ?? "",
      residencyExpiry: formatDateForExcel(d.employee.residencyExpiry),
      passportNumber: d.employee.passportNumber ?? "",
      passportExpiry: formatDateForExcel(d.employee.passportExpiryDate),
      licenseNumber: d.employee.licenseNumber ?? "",
      licenseExpiry: formatDateForExcel(d.employee.licenseExpiry),
      phone: d.employee.phone ?? "",
      baseSalary: d.employee.baseSalary ? Number(d.employee.baseSalary) : "",
      talabatId: d.talabatId ?? "",
      roPopsId: d.roPopsId ?? "",
      fuelCardNumber: d.fuelCardNumber ?? "",
      joinDate: formatDateForExcel(d.employee.joinDate),
      notes: d.employee.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "سائقو التوصيل", mode === "template");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${mode === "export" ? "delivery-drivers-export" : "delivery-drivers-template"}.xlsx"`,
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
  if (requiredErrors.length > 0) return NextResponse.json({ success: false, errors: requiredErrors });

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    try {
      const employeePayload = {
        companyId,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        type: "DELIVERY_DRIVER" as const,
        nationality: data.nationality || null,
        civilId: data.civilId || null,
        residencyNumber: data.residencyNumber || null,
        residencyExpiry: parseDate(data.residencyExpiry),
        passportNumber: data.passportNumber || null,
        passportExpiryDate: parseDate(data.passportExpiry),
        licenseNumber: data.licenseNumber || null,
        licenseExpiry: parseDate(data.licenseExpiry),
        phone: data.phone || null,
        baseSalary: data.baseSalary ? Number(data.baseSalary) : null,
        joinDate: parseDate(data.joinDate),
        notes: data.notes || null,
      };

      const driverPayload = {
        talabatId: data.talabatId || null,
        roPopsId: data.roPopsId || null,
        fuelCardNumber: data.fuelCardNumber || null,
      };

      if (data.civilId) {
        const existing = await prisma.employee.findFirst({
          where: { companyId, civilId: data.civilId, isDeleted: false },
        });
        if (existing) {
          await prisma.employee.update({ where: { id: existing.id }, data: employeePayload });
          const existingDriver = await prisma.driver.findUnique({ where: { employeeId: existing.id } });
          if (existingDriver) {
            await prisma.driver.update({ where: { id: existingDriver.id }, data: driverPayload });
          } else {
            await prisma.driver.create({ data: { ...driverPayload, employeeId: existing.id } });
          }
          result.updated++;
          continue;
        }
      }

      const employee = await prisma.employee.create({ data: employeePayload });
      await prisma.driver.create({ data: { ...driverPayload, employeeId: employee.id } });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
