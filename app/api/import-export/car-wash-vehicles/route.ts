import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";

const COLS: ColDef[] = [
  { header: "كود المركبة *",          key: "code",               required: true, width: 12, example: "CW-01" },
  { header: "الاسم بالعربية *",       key: "nameAr",             required: true, width: 25, example: "مركبة غسيل 1" },
  { header: "الاسم بالإنجليزية",      key: "nameEn",             width: 25, example: "Car Wash Vehicle 1" },
  { header: "رقم اللوحة *",           key: "plateNumber",        required: true, width: 14, example: "أ ب ج 5678" },
  { header: "الماركة",                key: "make",               width: 16, example: "تويوتا" },
  { header: "الموديل",                key: "model",              width: 16, example: "هايلوكس" },
  { header: "السنة",                  key: "year",               width: 8,  example: "2021" },
  { header: "اللون",                  key: "color",              width: 12, example: "أبيض" },
  { header: "تاريخ انتهاء التسجيل",  key: "registrationExpiry", width: 18, example: "31/03/2026" },
  { header: "تاريخ انتهاء التأمين",  key: "insuranceExpiry",    width: 18, example: "31/03/2026" },
  { header: "ملاحظات",                key: "notes",              width: 30, example: "" },
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
    const cwVehicles = await prisma.carWashVehicle.findMany({
      where: { companyId, isActive: true },
      include: { vehicle: true },
      orderBy: { code: "asc" },
    });
    rows = cwVehicles.map((cw) => ({
      code: cw.code,
      nameAr: cw.nameAr,
      nameEn: cw.nameEn ?? "",
      plateNumber: cw.vehicle.plateNumber,
      make: cw.vehicle.make ?? "",
      model: cw.vehicle.model ?? "",
      year: cw.vehicle.year ?? "",
      color: cw.vehicle.color ?? "",
      registrationExpiry: formatDateForExcel(cw.vehicle.registrationExpiry),
      insuranceExpiry: formatDateForExcel(cw.vehicle.insuranceExpiryDate),
      notes: cw.vehicle.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "مركبات الغسيل", mode === "template");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${mode === "export" ? "car-wash-vehicles-export" : "car-wash-vehicles-template"}.xlsx"`,
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
      const vehiclePayload = {
        companyId,
        plateNumber: data.plateNumber,
        type: "CAR_WASH" as const,
        make: data.make || null,
        model: data.model || null,
        year: data.year ? parseInt(data.year) : null,
        color: data.color || null,
        registrationExpiry: parseDate(data.registrationExpiry),
        insuranceExpiryDate: parseDate(data.insuranceExpiry),
        notes: data.notes || null,
      };

      // Check if car wash vehicle already exists by code
      const existingCW = await prisma.carWashVehicle.findFirst({
        where: { companyId, code: data.code },
        include: { vehicle: true },
      });

      if (existingCW) {
        await prisma.vehicle.update({ where: { id: existingCW.vehicleId }, data: vehiclePayload });
        await prisma.carWashVehicle.update({
          where: { id: existingCW.id },
          data: { nameAr: data.nameAr, nameEn: data.nameEn || null },
        });
        result.updated++;
      } else {
        // Check if vehicle with this plate exists
        let vehicle = await prisma.vehicle.findFirst({ where: { companyId, plateNumber: data.plateNumber } });
        if (!vehicle) {
          vehicle = await prisma.vehicle.create({ data: vehiclePayload });
        }
        await prisma.carWashVehicle.create({
          data: { companyId, vehicleId: vehicle.id, code: data.code, nameAr: data.nameAr, nameEn: data.nameEn || null },
        });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
