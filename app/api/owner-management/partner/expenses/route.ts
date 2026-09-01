import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage/r2";
import { getPartnerFromSession, forbidden } from "@/lib/owner-management/access";
import { isRateLimited, requestClientKey } from "@/lib/security/rate-limit";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 10;
const bodySchema = z.object({ invoiceDate: z.coerce.date(), amount: z.coerce.number().positive(), notes: z.string().optional(), imageUrl: z.string().url().optional(), ocrRawText: z.string().optional() });
const batchSchema = z.array(z.object({ invoiceDate: z.coerce.date(), amount: z.coerce.number().positive(), notes: z.string().optional(), ocrRawText: z.string().optional() })).min(1).max(MAX_BATCH_SIZE);

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const partner = await getPartnerFromSession(session); if (!partner) return forbidden();
  return NextResponse.json({ success: true, data: await prisma.ownerManagedExpense.findMany({ where: { partnerId: partner.id, deletedAt: null }, orderBy: { invoiceDate: "desc" } }) });
}

function validateFile(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) return "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.";
  if (!file.size || file.size > MAX_SIZE) return "حجم الصورة يجب ألا يتجاوز 10 ميجابايت.";
  return null;
}

async function uploadExpenseImage(file: File, companyId: string, partnerId: string) {
  const error = validateFile(file); if (error) throw new Error(error);
  const ext = file.type.split("/")[1];
  const key = `owner-managed-expenses/${companyId}/${partnerId}/${nanoid(14)}.${ext}`;
  return uploadToR2(key, Buffer.from(await file.arrayBuffer()), file.type);
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  if (isRateLimited(requestClientKey(request, session.id), 12, 10 * 60_000)) return NextResponse.json({ success: false, error: "تم تجاوز حد رفع الفواتير. حاول لاحقًا." }, { status: 429 });
  const partner = await getPartnerFromSession(session); if (!partner) return forbidden();

  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const batchRaw = form?.get("items");

    if (typeof batchRaw === "string") {
      let rawItems: unknown;
      try { rawItems = JSON.parse(batchRaw); } catch { return NextResponse.json({ success: false, error: "بيانات الفواتير غير صالحة." }, { status: 400 }); }
      const parsed = batchSchema.safeParse(rawItems);
      const files = form?.getAll("files") ?? [];
      if (!parsed.success || files.length !== parsed.data.length || files.some((file) => !(file instanceof File))) return NextResponse.json({ success: false, error: `ارفع من 1 إلى ${MAX_BATCH_SIZE} صور فواتير مع بياناتها.` }, { status: 400 });
      const images = await Promise.all((files as File[]).map((file) => uploadExpenseImage(file, partner.companyId, partner.id)));
      const expenses = await prisma.$transaction(parsed.data.map((item, index) => prisma.ownerManagedExpense.create({ data: { companyId: partner.companyId, partnerId: partner.id, createdById: session.id, invoiceDate: item.invoiceDate, amount: item.amount.toFixed(3), notes: item.notes, imageUrl: images[index], ocrRawText: item.ocrRawText } })));
      return NextResponse.json({ success: true, data: expenses, count: expenses.length }, { status: 201 });
    }

    const file = form?.get("file");
    const rawInput = form ? { invoiceDate: form.get("invoiceDate"), amount: form.get("amount"), notes: form.get("notes") || undefined, ocrRawText: form.get("ocrRawText") || undefined } : await request.json();
    const parsed = bodySchema.safeParse(rawInput);
    if (!parsed.success) return NextResponse.json({ success: false, error: "بيانات الفاتورة غير صحيحة. راجع التاريخ والمبلغ." }, { status: 400 });
    const imageUrl = file instanceof File ? await uploadExpenseImage(file, partner.companyId, partner.id) : parsed.data.imageUrl;
    const expense = await prisma.ownerManagedExpense.create({ data: { companyId: partner.companyId, partnerId: partner.id, createdById: session.id, invoiceDate: parsed.data.invoiceDate, amount: parsed.data.amount.toFixed(3), notes: parsed.data.notes, imageUrl, ocrRawText: parsed.data.ocrRawText } });
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("Owner-managed partner expense upload failed:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "تعذر حفظ الفاتورة. حاول مرة أخرى." }, { status: 500 });
  }
}
