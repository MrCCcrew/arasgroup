import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string }> }
function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

export async function GET(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { licenseId } = await params;
  const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
  if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
  const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
  const vehicles = await prisma.licenseVehicle.findMany({ where: { licenseId }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({ success: true, data: vehicles });
}

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    const body = await request.json() as Record<string, unknown>;
    if (!body.plateNumber) return NextResponse.json({ success: false, error: "رقم اللوحة مطلوب" }, { status: 400 });

    const vehicle = await prisma.licenseVehicle.create({
      data: {
        licenseId,
        vehicleType:     body.vehicleType     as string ?? "",
        plateNumber:     body.plateNumber     as string,
        model:           body.model           as string | null ?? null,
        year:            body.year != null ? Number(body.year) : null,
        insuranceExpiry: toDate(body.insuranceExpiry),
        licenseExpiry:   toDate(body.licenseExpiry),
        notes:           body.notes           as string | null ?? null,
      },
    });
    return NextResponse.json({ success: true, data: vehicle });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
