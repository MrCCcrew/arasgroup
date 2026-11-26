import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession, assertCompanyAccess, assertPermission } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { extractPdfText } from "@/lib/owner-management/pdf-text";
import { normalizeMid, parseNbkVisualRows } from "@/lib/owner-management/nbk-parser";
import { savePreview } from "@/lib/owner-management/preview-store";

const retailTypes = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] as const;
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { companyId } = await params;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY", "UPDATE", { companyId }); if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: { in: [...retailTypes] }, isActive: true }, select: { id: true } });
  if (!company) return NextResponse.json({ success: false, error: "Retail operations are not enabled" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0 || file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, error: "Attach a PDF statement up to 15 MB" }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer()); const extracted = await extractPdfText(bytes);
  const devices = await prisma.groceryKnetDevice.findMany({ where: { companyId, isActive: true }, select: { number: true, label: true } });
  const deviceByMid = new Map(devices.map((device) => [normalizeMid(device.number), device]).filter((entry): entry is [string, { number: string; label: string | null }] => Boolean(entry[0])));
  const rows = parseNbkVisualRows(extracted.visualRows).map((row) => {
    const isKnetRevenue = /\b(KNET|POS|POINT\s*OF\s*SALE)\b/i.test(row.description) && Number(row.amount) > 0 && row.transactionDate;
    const rowMid = row.mid ? normalizeMid(row.mid) : null;
    const device = rowMid ? deviceByMid.get(rowMid) : undefined;
    return { ...row, deviceNumber: device?.number, deviceLabel: device?.label, status: !isKnetRevenue ? "IGNORED" : device && row.transactionReference ? "MATCHED" : row.mid ? "REVIEW" : "UNMATCHED" };
  });
  const selected = rows.filter((row) => row.status === "MATCHED");
  const token = randomUUID();
  savePreview(token, { companyId, userId: session.id, fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, "_"), bytes, pages: extracted.pages, rows, expiresAt: Date.now() + 15 * 60_000 });
  return NextResponse.json({ success: true, data: { token, pageCount: extracted.pageCount, rows, summary: { total: rows.length, matched: selected.length, knetRevenue: selected.length, review: rows.filter((row) => row.status === "REVIEW").length, unmatched: rows.filter((row) => row.status === "UNMATCHED").length, ignored: rows.filter((row) => row.status === "IGNORED").length } } });
}

