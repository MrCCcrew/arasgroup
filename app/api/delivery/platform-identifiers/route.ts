import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

const createSchema = z.object({
  driverId: z.string().min(1),
  companyId: z.string().min(1),
  platform: z.string().min(1),
  platformDriverId: z.string().min(1),
  isPrimary: z.boolean().default(true),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const driverId = searchParams.get("driverId");
  const companyId = searchParams.get("companyId");

  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  const err = assertCompanyAccess(session, companyId);
  if (err) return err;

  const identifiers = await prisma.driverPlatformIdentifier.findMany({
    where: { ...(driverId ? { driverId } : {}), isActive: true },
    include: { driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } } },
    orderBy: [{ platform: "asc" }, { isPrimary: "desc" }],
  });

  return NextResponse.json({ success: true, data: identifiers });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const err = assertCompanyAccess(session, parsed.data.companyId);
  if (err) return err;

  const existing = await prisma.driverPlatformIdentifier.findUnique({
    where: { platform_platformDriverId: { platform: parsed.data.platform, platformDriverId: parsed.data.platformDriverId } },
  });
  if (existing) {
    return NextResponse.json({ success: false, error: "هذا الكود مسجّل بالفعل لسائق آخر على نفس المنصة" }, { status: 409 });
  }

  const identifier = await prisma.driverPlatformIdentifier.create({
    data: {
      driverId: parsed.data.driverId,
      platform: parsed.data.platform,
      platformDriverId: parsed.data.platformDriverId,
      isPrimary: parsed.data.isPrimary,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ success: true, data: identifier }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const companyId = searchParams.get("companyId");
  if (!id || !companyId) return NextResponse.json({ success: false, error: "id و companyId مطلوبان" }, { status: 400 });

  const err = assertCompanyAccess(session, companyId);
  if (err) return err;

  await prisma.driverPlatformIdentifier.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
