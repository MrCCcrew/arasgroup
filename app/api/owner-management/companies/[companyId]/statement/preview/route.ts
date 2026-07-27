import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { requireOwnerManagedCompany, forbidden } from "@/lib/owner-management/access";
import { parseNbkVisualRows } from "@/lib/owner-management/nbk-parser";
import { prisma } from "@/lib/db";
import { extractPdfText } from "@/lib/owner-management/pdf-text";
import { savePreview } from "@/lib/owner-management/preview-store";
import { isRateLimited, requestClientKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "statement.pdf";

function previewError(error: unknown) {
  const technical = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error("Owner-management statement preview failed:", error);
  return NextResponse.json({ success: false, error: "تعذرت معاينة كشف الحساب.", ...(process.env.NODE_ENV !== "production" ? { details: technical } : {}) }, { status: 500 });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;
    if (isRateLimited(requestClientKey(request, session.id), 8, 10 * 60_000)) return NextResponse.json({ success: false, error: "تم تجاوز حد معاينات كشف الحساب. حاول لاحقًا." }, { status: 429 });
    const { companyId } = await params;
    if (!await requireOwnerManagedCompany(session, companyId)) return forbidden();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf") return NextResponse.json({ success: false, error: "يرجى رفع ملف PDF صالح." }, { status: 400 });
    if (file.size === 0 || file.size > MAX_PDF_BYTES) return NextResponse.json({ success: false, error: "حجم ملف PDF غير مسموح." }, { status: 400 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPdfText(bytes);
    if (!extracted.pages.some((page) => page.trim())) return NextResponse.json({ success: false, error: "تعذر استخراج نص كشف الحساب." }, { status: 422 });

    const rows = parseNbkVisualRows(extracted.visualRows);
    const partnerMids = new Map((await prisma.ownerManagedPartner.findMany({ where: { companyId, isActive: true }, select: { id: true, name: true, mid: true } })).map((partner) => [partner.mid, partner]));
    const prepared = rows.map((row) => {
      const hasRequiredValues = Boolean(row.transactionDate && row.postingDate && row.amount && Number(row.amount) !== 0);
      const partner = row.mid ? partnerMids.get(row.mid) : undefined;
      const partnerId = partner?.id;
      const status = !hasRequiredValues ? "INVALID" : row.mid && partnerId && row.transactionReference ? "MATCHED" : row.mid ? "REVIEW" : "UNMATCHED";
      return { ...row, partnerId, partnerName: partner?.name, status };
    });

    const token = randomUUID();
    savePreview(token, { companyId, userId: session.id, fileName: safeFileName(file.name), bytes, pages: extracted.pages, rows: prepared, expiresAt: Date.now() + 15 * 60_000 });
    return NextResponse.json({ success: true, data: { token, pageCount: extracted.pageCount, rows: prepared, summary: { total: prepared.length, matched: prepared.filter((row) => row.status === "MATCHED").length, unmatched: prepared.filter((row) => row.status === "UNMATCHED").length, invalid: prepared.filter((row) => row.status === "INVALID").length, review: prepared.filter((row) => row.status === "REVIEW").length } } });
  } catch (error) {
    return previewError(error);
  }
}
