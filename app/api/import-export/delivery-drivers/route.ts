import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook,
  parseWorkbook,
  validateRequired,
  parseDate,
  formatDateForExcel,
  type ColDef,
  type ImportResult,
} from "@/lib/excel/import-export";

const COLS: ColDef[] = [
  { header: "الاسم بالعربية *", key: "nameAr", required: true, width: 25, example: "خالد محمد العجمي" },
  { header: "الاسم بالإنجليزية", key: "nameEn", width: 25, example: "Khaled Al-Ajmi" },
  { header: "الجنسية", key: "nationality", width: 14, example: "كويتي" },
  { header: "رقم الهوية المدنية", key: "civilId", width: 15, example: "287654321098" },
  { header: "رقم الإقامة", key: "residencyNumber", width: 18, example: "123456789012" },
  { header: "تاريخ انتهاء الإقامة", key: "residencyExpiry", width: 18, example: "15/06/2026" },
  { header: "رقم جواز السفر", key: "passportNumber", width: 18, example: "A1234567" },
  { header: "تاريخ انتهاء الجواز", key: "passportExpiry", width: 18, example: "31/12/2028" },
  { header: "رقم رخصة القيادة", key: "licenseNumber", width: 18, example: "KW-123456" },
  { header: "تاريخ انتهاء الرخصة", key: "licenseExpiry", width: 18, example: "01/01/2027" },
  { header: "الهاتف", key: "phone", width: 14, example: "65001234" },
  { header: "الراتب", key: "baseSalary", width: 12, example: "150.000" },
  { header: "رقم Talabat", key: "talabatId", width: 16, example: "12345" },
  { header: "رقم RoPops", key: "roPopsId", width: 16, example: "RP-6789" },
  { header: "رقم كرت الوقود", key: "fuelCardNumber", width: 18, example: "FC-001234" },
  { header: "تاريخ الالتحاق", key: "joinDate", width: 16, example: "01/01/2024" },
  { header: "ملاحظات", key: "notes", width: 30, example: "" },
];

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template";

  if (!companyId) {
    return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });
  }

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const drivers = await prisma.driver.findMany({
      where: { employee: { companyId, isActive: true, isDeleted: false } },
      include: { employee: true },
      orderBy: { createdAt: "asc" },
    });

    rows = drivers.map((driver) => ({
      nameAr: driver.employee.nameAr,
      nameEn: driver.employee.nameEn ?? "",
      nationality: driver.employee.nationality ?? "",
      civilId: driver.employee.civilId ?? "",
      residencyNumber: driver.employee.residencyNumber ?? "",
      residencyExpiry: formatDateForExcel(driver.employee.residencyExpiry),
      passportNumber: driver.employee.passportNumber ?? "",
      passportExpiry: formatDateForExcel(driver.employee.passportExpiryDate),
      licenseNumber: driver.employee.licenseNumber ?? "",
      licenseExpiry: formatDateForExcel(driver.employee.licenseExpiry),
      phone: driver.employee.phone ?? "",
      baseSalary: driver.employee.baseSalary ? Number(driver.employee.baseSalary) : "",
      talabatId: driver.talabatId ?? "",
      roPopsId: driver.roPopsId ?? "",
      fuelCardNumber: driver.fuelCardNumber ?? "",
      joinDate: formatDateForExcel(driver.employee.joinDate),
      notes: driver.employee.notes ?? "",
    }));
  }

  const workbook = buildWorkbook(COLS, rows, "سائقو التوصيل", mode === "template");
  return new NextResponse(workbook, {
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
  if (!companyId) {
    return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buffer, COLS);
  const requiredErrors = validateRequired(parsedRows, COLS);

  if (requiredErrors.length > 0) {
    return NextResponse.json({ success: false, errors: requiredErrors });
  }

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    try {
      const civilId = data.civilId || null;

      const employeePayload = {
        companyId,
        nameAr: data.nameAr,
        nameEn: data.nameEn || null,
        type: "DELIVERY_DRIVER" as const,
        nationality: data.nationality || null,
        civilId,
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
        isActive: true,
        isDeleted: false,
        deletedAt: null,
      };

      const driverPayload = {
        talabatId: data.talabatId || null,
        roPopsId: data.roPopsId || null,
        fuelCardNumber: data.fuelCardNumber || null,
      };

      let employee = civilId
        ? await prisma.employee.findFirst({
            where: { companyId, civilId },
          })
        : null;

      if (!employee && !civilId && data.nameAr) {
        employee = await prisma.employee.findFirst({
          where: {
            companyId,
            nameAr: data.nameAr,
            type: "DELIVERY_DRIVER",
            isDeleted: false,
          },
        });
      }

      if (employee) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: employeePayload,
        });

        const existingDriver = await prisma.driver.findUnique({
          where: { employeeId: employee.id },
        });

        if (existingDriver) {
          await prisma.driver.update({
            where: { id: existingDriver.id },
            data: driverPayload,
          });
        } else {
          await prisma.driver.create({
            data: {
              employeeId: employee.id,
              ...driverPayload,
            },
          });
        }

        result.updated++;
        continue;
      }

      const createdEmployee = await prisma.employee.create({
        data: employeePayload,
      });

      await prisma.driver.create({
        data: {
          employeeId: createdEmployee.id,
          ...driverPayload,
        },
      });

      result.created++;
    } catch (error) {
      result.errors.push({
        row: rowIndex,
        message: `الصف ${rowIndex}: ${error instanceof Error ? error.message : "خطأ غير متوقع"}`,
      });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
