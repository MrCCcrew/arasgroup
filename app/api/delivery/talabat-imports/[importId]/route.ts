import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ importId: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId },
    include: {
      contract: { select: { nameAr: true, nameEn: true } },
      createdBy: { select: { nameAr: true } },
      riders: {
        include: {
          matchedDriver: {
            include: { employee: { select: { nameAr: true, nameEn: true } } },
          },
          allocations: {
            include: {
              driver: { include: { employee: { select: { nameAr: true, nameEn: true } } } },
            },
          },
        },
        orderBy: { talabatRiderName: "asc" },
      },
    },
  });

  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  return NextResponse.json({ success: true, data: imp });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId }, select: { companyId: true, status: true },
  });
  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  const body = await request.json();
  const updated = await prisma.talabatReportImport.update({
    where: { id: importId },
    data: {
      notes: body.notes ?? undefined,
      contractId: body.contractId ?? undefined,
    },
  });
  return NextResponse.json({ success: true, data: updated });
}
