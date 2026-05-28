import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { buildWorkbook, parseWorkbook, validateRequired, type ColDef, type ImportResult } from "@/lib/excel/import-export";

const COLS: ColDef[] = [
  { header: "الاسم بالعربية *",    key: "nameAr",  required: true, width: 25, example: "عبدالله محمد الكندي" },
  { header: "الاسم بالإنجليزية",  key: "nameEn",  width: 25, example: "Abdullah Al-Kindi" },
  { header: "رقم الهوية المدنية", key: "civilId", width: 15, example: "282041234567" },
  { header: "الهاتف",             key: "phone",   width: 14, example: "99001234" },
  { header: "هاتف 2",             key: "phone2",  width: 14, example: "65001234" },
  { header: "البريد الإلكتروني",  key: "email",   width: 28, example: "investor@example.com" },
  { header: "العنوان",            key: "address", width: 30, example: "الكويت - حولي - شارع تونس" },
  { header: "ملاحظات",            key: "notes",   width: 35, example: "" },
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
    const investors = await prisma.investor.findMany({
      where: { isActive: true, investorBranches: { some: { branch: { companyId } } } },
      orderBy: { nameAr: "asc" },
    });
    rows = investors.map((inv) => ({
      nameAr: inv.nameAr,
      nameEn: inv.nameEn ?? "",
      civilId: inv.civilId ?? "",
      phone: inv.phone ?? "",
      phone2: inv.phone2 ?? "",
      email: inv.email ?? "",
      address: inv.address ?? "",
      notes: inv.notes ?? "",
    }));
  }

  const buf = buildWorkbook(COLS, rows, "المسئولون والمديرون", mode === "template");
  const filename = mode === "export" ? "investors-export.xlsx" : "investors-template.xlsx";

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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "الملف مطلوب" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const parsedRows = parseWorkbook(buf, COLS);

  const requiredErrors = validateRequired(parsedRows, COLS);
  if (requiredErrors.length > 0) return NextResponse.json({ success: false, errors: requiredErrors });

  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { rowIndex, data } of parsedRows) {
    const payload = {
      nameAr: data.nameAr,
      nameEn: data.nameEn || null,
      civilId: data.civilId || null,
      phone: data.phone || null,
      phone2: data.phone2 || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
    };

    try {
      if (data.civilId) {
        const existing = await prisma.investor.findFirst({ where: { civilId: data.civilId, isActive: true } });
        if (existing) {
          await prisma.investor.update({ where: { id: existing.id }, data: payload });
          result.updated++;
          continue;
        }
      }
      await prisma.investor.create({ data: payload });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowIndex, message: `الصف ${rowIndex}: ${err instanceof Error ? err.message : "خطأ غير متوقع"}` });
    }
  }

  return NextResponse.json({ success: true, ...result });
}
