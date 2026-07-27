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
const bodySchema = z.object({
  invoiceDate: z.coerce.date(),
  amount: z.coerce.number().positive(),
  notes: z.string().optional(),
  imageUrl: z.string().url().optional(),
  ocrRawText: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const partner = await getPartnerFromSession(session);
  if (!partner) return forbidden();
  return NextResponse.json({ success: true, data: await prisma.ownerManagedExpense.findMany({ where: { partnerId: partner.id, deletedAt: null }, orderBy: { invoiceDate: "desc" } }) });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (isRateLimited(requestClientKey(request, session.id), 12, 10 * 60_000)) return NextResponse.json({ success: false, error: "تم تجاوز حد رفع الفواتير. حاول لاحقًا." }, { status: 429 });
  const partner = await getPartnerFromSession(session);
  if (!partner) return forbidden();

  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const file = form?.get("file");
    const rawInput = form ? {
      invoiceDate: form.get("invoiceDate"),
      amount: form.get("amount"),
      notes: form.get("notes") || undefined,
      ocrRawText: form.get("ocrRawText") || undefined,
    } : await request.json();
    const parsed = bodySchema.safeParse(rawInput);
    if (!parsed.success) return NextResponse.json({ success: false, error: "بيانات الفاتورة غير صحيحة. راجع التاريخ والمبلغ." }, { status: 400 });

    let imageUrl = parsed.data.imageUrl;
    if (file instanceof File) {
      if (!IMAGE_TYPES.includes(file.type)) return NextResponse.json({ success: false, error: "نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP." }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ success: false, error: "حجم الصورة يتجاوز 10 ميجابايت." }, { status: 400 });
      const ext = file.type.split("/")[1];
      const key = `owner-managed-expenses/${partner.companyId}/${partner.id}/${nanoid(14)}.${ext}`;
      imageUrl = await uploadToR2(key, Buffer.from(await file.arrayBuffer()), file.type);
    }

    const expense = await prisma.ownerManagedExpense.create({
      data: {
        companyId: partner.companyId,
        partnerId: partner.id,
        createdById: session.id,
        invoiceDate: parsed.data.invoiceDate,
        amount: parsed.data.amount.toFixed(3),
        notes: parsed.data.notes,
        imageUrl,
        ocrRawText: parsed.data.ocrRawText,
      },
    });
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    console.error("Owner-managed partner expense upload failed:", error);
    return NextResponse.json({ success: false, error: "تعذر حفظ الفاتورة. حاول مرة أخرى." }, { status: 500 });
  }
}
