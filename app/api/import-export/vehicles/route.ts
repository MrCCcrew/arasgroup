import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import {
  buildWorkbook, parseWorkbook, validateRequired, parseDate, formatDateForExcel,
  VEHICLE_TYPE_LABELS, VEHICLE_TYPE_DISPLAY, parseEnum,
  type ColDef, type ImportResult,
} from "@/lib/excel/import-export";
import type { VehicleType } from "@prisma/client";

const COLS: ColDef[] = [
  { header: "رقم اللوحة *",            key: "plateNumber",             required: true, width: 14, example: "أ ب ج 1234" },
  { header: "نوع المركبة *",            key: "type",                    required: true, width: 14, example: "إداري" },
  { header: "الماركة",                  key: "make",                    width: 16, example: "تويوتا" },
  { header: "الموديل",                  key: "model",                   width: 16, example: "كورولا" },
  { header: "السنة",                    key: "year",                    width: 8,  example: "2022" },
  { header: "اللون",                    key: "color",                   width: 12, example: "أبيض" },
  { header: "رقم الشاسيه",             key: "chassisNumber",           width: 20, example: "JN1AZ4EH9CM123456" },
  { header: "رقم دفتر التسجيل",        key: "registrationBookNumber",  width: 20, example: "12345678" },
  { header: "تاريخ انتهاء التسجيل",    key: "registrationExpiry",      width: 18, example: "31/03/2026" },
  { header: "تاريخ انتهاء التأمين",    key: "insuranceExpiryDate",     width: 18, example: "31/03/2026" },
  { header: "ملاحظات",                  key: "notes",                   width: 30, example: "" },
];

const VEHICLE_TYPES: VehicleType[] = ["DELIVERY", "CAR_WASH", "ADMIN"];

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = request.nextUrl;
  const companyId = searchParams.get("companyId");
  const mode = searchParams.get("mode") ?? "template";
  if (!companyId) return NextResponse.json({ error: "companyId مطلوب" }, { status: 400 });

  let rows: Record<string, unknown>[] = [];

  if (mode === "export") {
    const vehicles = await prisma.vehicle.findMany({
      where: { companyId, isActive: true },
      orderBy: { plateNumber: "asc" },
    });
    rows = vehicles.map((v) => ({
      plateNumber: v.plateNumber,
      type: VEHICLE_TYPE_DISPLAY[v.type] ?? v.type,
      make: v.make ?? "",
      model: v.model ?? "",
      year: v.year ?? "",
      color: v.color ?? "",
      chassisNumber: v.chassisNumber ?? "",
      registrationBookNumber: v.registrationBookNumber ?? "",
      registrationExpiry: formatDateForExcel(v.registrationExpiry),
      insuranceExpiryDate: formatDateForExcel(v.insuranceExpiryDate),
      notes: v.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "المركبات", mode === "template");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${mode === "export" ? "vehicles-export" : "vehicles-template"}.xlsx"`,
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
    const vehicleType = parseEnum(data.type, VEHICLE_TYPE_LABELS, VEHICLE_TYPES);
    if (!vehicleType) {
      result.errors.push({ row: rowIndex, field: "نوع المركبة", message: `الصف ${rowIndex}: نوع المركبة "${data.type}" غير صحيح. القيم: توصيل، غسيل سيارات، إداري` });
      continue;
    }

    const payload = {
      companyId,
      plateNumber: data.plateNumber,
      type: vehicleType,
      make: data.make || null,
      model: data.model || null,
      year: data.year ? parseInt(data.year) : null,
      color: data.color || null,
      chassisNumber: data.chassisNumber || null,
      registrationBookNumber: data.registrationBookNumber || null,
      registrationExpiry: parseDate(data.registrationExpiry),
      insuranceExpiryDate: parseDate(data.insuranceExpiryDate),
      notes: data.notes || null,
    };

    try {
      const existing = await prisma.vehicle.findFirst({ where: { companyId, plateNumber: data.plateNumber, isActive: true } });
      if (existing) {
        await prisma.vehicle.update({ where: { id: existing.id }, data: payload });
        result.updated++;
      } else {
        await prisma.vehicle.create({ data: payload });
        result.created++;
      }
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
