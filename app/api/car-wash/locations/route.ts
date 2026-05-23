import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const activeOnly = searchParams.get("activeOnly") !== "false";

  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const locations = await prisma.carWashLocation.findMany({
    where: { companyId, ...(activeOnly ? { isActive: true } : {}) },
    select: {
      id: true, nameAr: true, nameEn: true,
      address: true, locationType: true, isActive: true,
      _count: { select: { operations: true } },
    },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({ success: true, data: locations });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { companyId, nameAr, nameEn, address, locationType } = body;

  if (!companyId || !nameAr?.trim())
    return NextResponse.json({ success: false, error: "companyId والاسم العربي مطلوبان" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const location = await prisma.carWashLocation.create({
    data: {
      companyId,
      nameAr: nameAr.trim(),
      nameEn: nameEn?.trim() || null,
      address: address?.trim() || null,
      locationType: locationType?.trim() || null,
      isActive: true,
    },
  });

  return NextResponse.json({ success: true, data: location }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const { id, nameAr, nameEn, address, locationType, isActive } = body;

  if (!id) return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });

  const existing = await prisma.carWashLocation.findUnique({ where: { id }, select: { companyId: true } });
  if (!existing) return NextResponse.json({ success: false, error: "الموقع غير موجود" }, { status: 404 });

  const companyAccessError = assertCompanyAccess(session, existing.companyId);
  if (companyAccessError) return companyAccessError;

  const updated = await prisma.carWashLocation.update({
    where: { id },
    data: {
      ...(nameAr !== undefined ? { nameAr: nameAr.trim() } : {}),
      ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
      ...(address !== undefined ? { address: address?.trim() || null } : {}),
      ...(locationType !== undefined ? { locationType: locationType?.trim() || null } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });

  const existing = await prisma.carWashLocation.findUnique({
    where: { id },
    select: { companyId: true, _count: { select: { operations: true } } },
  });
  if (!existing) return NextResponse.json({ success: false, error: "الموقع غير موجود" }, { status: 404 });

  const companyAccessError = assertCompanyAccess(session, existing.companyId);
  if (companyAccessError) return companyAccessError;

  if (existing._count.operations > 0) {
    await prisma.carWashLocation.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, deactivated: true });
  }

  await prisma.carWashLocation.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
