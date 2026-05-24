import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ investorId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2, "الاسم مطلوب").optional(),
  nameEn: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  phone2: z.string().optional().nullable(),
  civilId: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  companyId: z.string(), // for access check
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { investorId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, ...data } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const investor = await prisma.investor.findFirst({
      where: { id: investorId, isActive: true, companies: { some: { id: companyId } } },
    });
    if (!investor) {
      return NextResponse.json({ success: false, error: "المستثمر غير موجود" }, { status: 404 });
    }

    const updated = await prisma.investor.update({
      where: { id: investorId },
      data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تعديل المستثمر";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { investorId } = await params;
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام لحذف المستثمر" }, { status: 403 });
    }

    const investor = await prisma.investor.findFirst({
      where: { id: investorId, isActive: true, companies: { some: { id: companyId } } },
      include: { _count: { select: { claims: true } } },
    });
    if (!investor) {
      return NextResponse.json({ success: false, error: "المستثمر غير موجود" }, { status: 404 });
    }

    // Soft delete only — never hard delete investors with history
    await prisma.investor.update({
      where: { id: investorId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId,
        action: "DEACTIVATE_INVESTOR",
        module: "investors",
        resourceId: investorId,
        resourceType: "Investor",
        oldValues: { nameAr: investor.nameAr },
        ipAddress: request.headers.get("x-forwarded-for") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف المستثمر";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
