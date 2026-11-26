import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { extractPdfText } from "@/lib/owner-management/pdf-text";
import { normalizeMid, parseNbkVisualRows } from "@/lib/owner-management/nbk-parser";
import { saveCarWashKnetPreview } from "@/lib/car-wash/knet-bank-preview-store";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const form = await request.formData();
    const companyId = String(form.get("companyId") ?? "");
    const file = form.get("file");
    const access = assertCompanyAccess(session, companyId);
    if (access) return access;
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0 || file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ success: false, error: "Upload a valid PDF statement (maximum 15 MB)." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const extracted = await extractPdfText(bytes);
    const devices = await prisma.carWashVehicle.findMany({ where: { companyId, isActive: true, knetDeviceId: { not: null } }, select: { id: true, code: true, knetDeviceId: true } });
    const byDevice = new Map(devices.map(vehicle => [normalizeMid(vehicle.knetDeviceId ?? ""), vehicle]));
    const rows = parseNbkVisualRows(extracted.visualRows).map(row => {
      const vehicle = row.mid ? byDevice.get(normalizeMid(row.mid)) : undefined;
      const valid = Boolean(row.transactionDate && Number(row.amount) > 0);
      return { ...row, vehicleId: vehicle?.id, vehicleCode: vehicle?.code, status: !valid ? "INVALID" : vehicle ? "MATCHED" : "UNMATCHED" } as const;
    });
    const token = randomUUID();
    saveCarWashKnetPreview(token, { companyId, userId: session.id, rows, expiresAt: Date.now() + 15 * 60_000 });
    return NextResponse.json({ success: true, data: { token, rows, summary: { total: rows.length, matched: rows.filter(row => row.status === "MATCHED").length, unmatched: rows.filter(row => row.status === "UNMATCHED").length, invalid: rows.filter(row => row.status === "INVALID").length } } });
  } catch (error) {
    console.error("Car wash KNET statement preview failed", error);
    return NextResponse.json({ success: false, error: "Could not read the KNET bank statement." }, { status: 422 });
  }
}
