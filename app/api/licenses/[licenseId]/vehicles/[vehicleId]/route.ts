import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

interface Props { params: Promise<{ licenseId: string; vehicleId: string }> }
function toDate(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v); return isNaN(d.getTime()) ? null : d;
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId, vehicleId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;

    const body = await request.json() as Record<string, unknown>;
    const updated = await prisma.licenseVehicle.update({
      where: { id: vehicleId },
      data: {
        vehicleType:     body.vehicleType     as string | undefined,
        plateNumber:     body.plateNumber     as string | undefined,
        model:           body.model           as string | null ?? undefined,
        year:            body.year != null ? Number(body.year) : undefined,
        insuranceExpiry: body.insuranceExpiry !== undefined ? toDate(body.insuranceExpiry) : undefined,
        licenseExpiry:   body.licenseExpiry   !== undefined ? toDate(body.licenseExpiry)   : undefined,
        notes:           body.notes           as string | null ?? undefined,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { licenseId, vehicleId } = await params;
    const lic = await prisma.license.findUnique({ where: { id: licenseId }, select: { companyId: true } });
    if (!lic) return NextResponse.json({ success: false, error: "الترخيص غير موجود" }, { status: 404 });
    const ce = assertCompanyAccess(session, lic.companyId); if (ce) return ce;
    await prisma.licenseVehicle.delete({ where: { id: vehicleId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "خطأ" }, { status: 500 });
  }
}
