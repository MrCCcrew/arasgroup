import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { uploadToR2 } from "@/lib/storage/r2";

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_SIZE = 10 * 1024 * 1024;

// قائمة الفواتير — أرشفة فقط (لا يؤثر على الحسابات).
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const targetType = searchParams.get("targetType");
  const driverId = searchParams.get("driverId");
  const employeeId = searchParams.get("employeeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = searchParams.get("search")?.trim();
  const reviewStatus = searchParams.get("reviewStatus");
  const uploadSource = searchParams.get("uploadSource");

  const where: Record<string, unknown> = {
    companyId,
    deletedAt: null,
    ...(targetType === "DRIVER" || targetType === "EMPLOYEE" ? { targetType } : {}),
    ...(reviewStatus === "PENDING_REVIEW" || reviewStatus === "APPROVED" || reviewStatus === "REJECTED" ? { reviewStatus } : {}),
    ...(uploadSource === "ADMIN" || uploadSource === "DRIVER_WEB" || uploadSource === "DRIVER_MOBILE" ? { uploadSource } : {}),
    ...(driverId ? { driverId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(from || to
      ? { invoiceDate: { ...(from ? { gte: new Date(`${from}T00:00:00.000`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } }
      : {}),
    ...(search
      ? {
          OR: [
            { notes: { contains: search } },
            { originalFileName: { contains: search } },
            { driver: { employee: { nameAr: { contains: search } } } },
            { employee: { nameAr: { contains: search } } },
          ],
        }
      : {}),
  };

  const invoices = await prisma.deliveryInvoice.findMany({
    where,
    include: {
      driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
      employee: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    success: true,
    data: invoices.map((inv) => ({
      id: inv.id,
      targetType: inv.targetType,
      driverId: inv.driverId,
      employeeId: inv.employeeId,
      name: inv.targetType === "DRIVER" ? inv.driver?.employee.nameAr ?? "-" : inv.employee?.nameAr ?? "-",
      invoiceDate: inv.invoiceDate,
      amount: Number(inv.amount),
      currency: inv.currency,
      imagePath: inv.imagePath,
      originalFileName: inv.originalFileName,
      notes: inv.notes,
      reviewStatus: inv.reviewStatus,
      uploadSource: inv.uploadSource,
      reviewedAt: inv.reviewedAt,
      rejectionReason: inv.rejectionReason,
      createdAt: inv.createdAt,
    })),
  });
}

// إنشاء فاتورة (multipart: صورة + الحقول). يرفع الصورة على R2 ويحفظ السجل.
export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const form = await request.formData();
    const file = form.get("file") as File | null;
    const companyId = (form.get("companyId") as string | null) ?? "";
    const targetType = (form.get("targetType") as string | null) ?? "";
    const driverId = (form.get("driverId") as string | null) || null;
    const employeeId = (form.get("employeeId") as string | null) || null;
    const invoiceDate = (form.get("invoiceDate") as string | null) ?? "";
    const amountRaw = (form.get("amount") as string | null) ?? "";
    const currency = (form.get("currency") as string | null) || "KWD";
    const notes = (form.get("notes") as string | null) || null;
    const ocrText = (form.get("ocrText") as string | null) || null;
    const ocrAmount = form.get("ocrAmount") ? Number(form.get("ocrAmount")) : null;
    const ocrDate = (form.get("ocrDate") as string | null) || null;

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    const accessError = assertCompanyAccess(session, companyId);
    if (accessError) return accessError;

    if (targetType !== "DRIVER" && targetType !== "EMPLOYEE") {
      return NextResponse.json({ success: false, error: "النوع غير صالح" }, { status: 400 });
    }
    if (targetType === "DRIVER" && !driverId) return NextResponse.json({ success: false, error: "اختر السائق" }, { status: 400 });
    if (targetType === "EMPLOYEE" && !employeeId) return NextResponse.json({ success: false, error: "اختر الموظف" }, { status: 400 });
    if (!invoiceDate) return NextResponse.json({ success: false, error: "تاريخ الفاتورة مطلوب" }, { status: 400 });
    const amount = Number(amountRaw);
    if (!amountRaw || isNaN(amount) || amount <= 0) return NextResponse.json({ success: false, error: "قيمة الفاتورة مطلوبة" }, { status: 400 });
    if (!file) return NextResponse.json({ success: false, error: "صورة الفاتورة مطلوبة" }, { status: 400 });

    const ext = IMAGE_EXT[file.type];
    if (!ext) return NextResponse.json({ success: false, error: "نوع الصورة غير مدعوم (JPG/PNG/WEBP)" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ success: false, error: "حجم الصورة يتجاوز 10 ميجابايت" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `delivery-invoices/${companyId}/${nanoid(14)}.${ext}`;
    const imagePath = await uploadToR2(key, buffer, file.type);

    const invoice = await prisma.deliveryInvoice.create({
      data: {
        companyId,
        targetType,
        driverId: targetType === "DRIVER" ? driverId : null,
        employeeId: targetType === "EMPLOYEE" ? employeeId : null,
        invoiceDate: new Date(`${invoiceDate}T12:00:00.000`),
        amount,
        currency,
        imagePath,
        storageKey: key,
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        ocrText,
        ocrAmount: ocrAmount && !isNaN(ocrAmount) ? ocrAmount : null,
        ocrDate: ocrDate ? new Date(`${ocrDate}T12:00:00.000`) : null,
        notes,
        createdById: session.id,
      },
    });

    return NextResponse.json({ success: true, data: { id: invoice.id } }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حفظ الفاتورة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
