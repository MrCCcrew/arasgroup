import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage/r2";
import { getPartnerFromSession, forbidden } from "@/lib/owner-management/access";
import { isRateLimited, requestClientKey } from "@/lib/security/rate-limit";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const inputSchema = z.object({ transactionDate: z.coerce.date(), amount: z.coerce.number().positive(), transactionReference: z.string().max(191).optional(), notes: z.string().max(4000).optional(), ocrRawText: z.string().max(20000).optional() });

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const partner = await getPartnerFromSession(session); if (!partner) return forbidden();
  const rows = await prisma.ownerManagedRevenue.findMany({ where: { partnerId: partner.id, status: "MATCHED" }, include: { import: { select: { storageUrl: true } } }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }], take: 100 });
  return NextResponse.json({ success: true, data: rows.map((row) => ({ ...row, receiptImageUrl: row.import.storageUrl })) });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  if (isRateLimited(requestClientKey(request, session.id), 12, 10 * 60_000)) return NextResponse.json({ success: false, error: "تم تجاوز حد رفع الإيصالات. حاول لاحقًا." }, { status: 429 });
  const partner = await getPartnerFromSession(session); if (!partner) return forbidden();
  try {
    const form = await request.formData(); const file = form.get("file");
    if (!(file instanceof File) || !IMAGE_TYPES[file.type] || file.size === 0 || file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: "ارفع صورة إيصال بصيغة JPG أو PNG أو WEBP وحجم لا يتجاوز 10 ميجابايت." }, { status: 400 });
    const parsed = inputSchema.safeParse({ transactionDate: form.get("transactionDate"), amount: form.get("amount"), transactionReference: form.get("transactionReference") || undefined, notes: form.get("notes") || undefined, ocrRawText: form.get("ocrRawText") || undefined });
    if (!parsed.success) return NextResponse.json({ success: false, error: "راجع تاريخ الإيداع وقيمته." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer()); const fileHash = createHash("sha256").update(bytes).digest("hex");
    const storageUrl = await uploadToR2(`owner-managed-deposits/${partner.companyId}/${partner.id}/${nanoid(14)}.${IMAGE_TYPES[file.type]}`, bytes, file.type);
    const reference = parsed.data.transactionReference || `DEPOSIT-${parsed.data.transactionDate.toISOString().slice(0, 10)}-${nanoid(8)}`;
    const result = await prisma.$transaction(async (tx) => {
      const imported = await tx.ownerManagedStatementImport.create({ data: { companyId: partner.companyId, fileName: file.name, fileHash, storageUrl, rawText: parsed.data.ocrRawText, importedById: session.id, confirmedAt: new Date() } });
      return tx.ownerManagedRevenue.create({ data: { companyId: partner.companyId, partnerId: partner.id, importId: imported.id, mid: partner.mid, transactionReference: reference, transactionDate: parsed.data.transactionDate, postingDate: parsed.data.transactionDate, amount: parsed.data.amount.toFixed(3), description: parsed.data.notes || "Partner cash deposit receipt", rawRowText: parsed.data.ocrRawText, pageNumber: 1, status: "MATCHED" } });
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) { console.error("Partner deposit receipt upload failed:", error); return NextResponse.json({ success: false, error: "تعذر حفظ إيصال الإيداع. قد تكون الصورة مرفوعة من قبل." }, { status: 500 }); }
}
