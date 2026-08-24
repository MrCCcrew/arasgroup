import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { requireOwnerManagedCompany, forbidden } from "@/lib/owner-management/access";
import { getPreview, takePreview } from "@/lib/owner-management/preview-store";
import { isRateLimited, requestClientKey } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  if (isRateLimited(requestClientKey(request, session.id), 5, 10 * 60_000)) return NextResponse.json({ success: false, error: "تم تجاوز حد تأكيد الاستيراد. حاول لاحقاً." }, { status: 429 });
  const { companyId } = await params; if (!await requireOwnerManagedCompany(session, companyId)) return forbidden();
  const { token } = await request.json(); if (!token) return NextResponse.json({ success: false, error: "بيانات المعاينة ناقصة" }, { status: 400 });
  const candidate = getPreview(token, companyId, session.id); if (!candidate) return NextResponse.json({ success: false, error: "انتهت المعاينة؛ أعد رفع الملف" }, { status: 410 });
  const invalid = candidate.rows.filter((row) => row.status === "INVALID").length;
  if (invalid / Math.max(candidate.rows.length, 1) > 0.2 || candidate.rows.every((row) => Number(row.amount) === 0)) return NextResponse.json({ success: false, error: "تعذر تأكيد معاينة غير مكتملة أو بلا عمليات صالحة" }, { status: 422 });
  const preview = takePreview(token, companyId, session.id); if (!preview) return NextResponse.json({ success: false, error: "انتهت المعاينة؛ أعد رفع الملف" }, { status: 410 });
  const fileHash = createHash("sha256").update(preview.bytes).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const imported = await tx.ownerManagedStatementImport.create({ data: { companyId, fileName: preview.fileName, fileHash, rawText: preview.pages.join("\f"), importedById: session.id, confirmedAt: new Date() } });
      const partners = new Map((await tx.ownerManagedPartner.findMany({ where: { companyId, isActive: true } })).map((partner) => [partner.mid, partner]));
      const skipped: Record<string, number> = {}; const totals: Record<string, number> = {}; let saved = 0; let unmatched = 0;
      for (const row of preview.rows) {
        const partner = row.mid ? partners.get(row.mid) : undefined;
        const hasValidDate = row.transactionDate instanceof Date && !Number.isNaN(row.transactionDate.getTime());
        if (row.status === "INVALID" || !hasValidDate || Number(row.amount) <= 0) { const reason = row.status === "INVALID" ? "INVALID" : !hasValidDate ? "MISSING_TRANSACTION_DATE" : "DEBIT_OR_ZERO_AMOUNT"; skipped[reason] = (skipped[reason] ?? 0) + 1; continue; }
        const transactionDate = row.transactionDate!;
        const transactionReference = row.transactionReference ?? `AUTO-${createHash("sha256").update(`${row.pageNumber}|${transactionDate.toISOString()}|${row.amount}|${row.rawRowText}`).digest("hex").slice(0, 24)}`;
        const isMatched = row.status === "MATCHED" && Boolean(partner && partner.id === row.partnerId);
        const status = isMatched ? "MATCHED" : row.mid ? "REVIEW" : "UNMATCHED";
        const duplicate = await tx.ownerManagedRevenue.findFirst({ where: { companyId, mid: row.mid, transactionReference, amount: new Prisma.Decimal(row.amount) }, select: { id: true } });
        if (duplicate) { skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1; continue; }
        await tx.ownerManagedRevenue.create({ data: { companyId, importId: imported.id, partnerId: isMatched ? partner!.id : null, mid: row.mid, transactionReference, transactionDate, postingDate: row.postingDate, amount: new Prisma.Decimal(row.amount), branchCode: row.branchCode, description: row.description, balance: row.balance ? new Prisma.Decimal(row.balance.replace(/,/g, "")) : undefined, pageNumber: row.pageNumber, rawRowText: row.rawRowText, status } });
        saved++; if (isMatched) totals[partner!.name] = (totals[partner!.name] ?? 0) + Number(row.amount); else unmatched++;
      }
      const skippedCount = Object.values(skipped).reduce((sum, count) => sum + count, 0);
      return { importId: imported.id, savedCount: saved, unmatchedCount: unmatched, duplicateCount: skipped.DUPLICATE ?? 0, totalsByPartner: Object.fromEntries(Object.entries(totals).map(([name, total]) => [name, total.toFixed(3)])), skipped, skippedCount };
    });
    return NextResponse.json({ success: true, ...result, data: result });
  } catch (error: unknown) {
    console.error("Owner-management statement confirm failed:", error);
    return NextResponse.json({ success: false, error: typeof error === "object" && error && "code" in error && error.code === "P2002" ? "ملف أو عملية مكررة" : "تعذر تأكيد الاستيراد" }, { status: 409 });
  }
}
