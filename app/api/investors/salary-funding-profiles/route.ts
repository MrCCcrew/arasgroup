import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const schema = z.object({
  companyId: z.string(),
  investorId: z.string(),
  branchId: z.string().optional().nullable(),
  workersCount: z.number().int().min(0),
  monthlyAmount: z.number().min(0),
  collectionStartDay: z.number().int().min(1).max(31).optional(),
  collectionEndDay: z.number().int().min(1).max(31).optional(),
  whatsappTemplateAr: z.string().optional().nullable(),
  whatsappTemplateEn: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    const investorId = searchParams.get("investorId");
    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyError = assertCompanyAccess(session, companyId);
    if (companyError) return companyError;
    const permissionError = assertPermission(session, "INVESTORS", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const profiles = await prisma.investorSalaryFundingProfile.findMany({
      where: {
        companyId,
        ...(investorId ? { investorId } : {}),
      },
      include: {
        branch: { select: { id: true, nameAr: true, nameEn: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: profiles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في جلب ملفات تمويل الرواتب";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyError = assertCompanyAccess(session, data.companyId);
    if (companyError) return companyError;
    const permissionError = assertPermission(session, "INVESTORS", "UPDATE", {
      companyId: data.companyId,
      branchId: data.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    const investor = await prisma.investor.findFirst({
      where: {
        id: data.investorId,
        isActive: true,
        companies: { some: { id: data.companyId } },
      },
      select: { id: true },
    });
    if (!investor) {
      return NextResponse.json({ success: false, error: "المستثمر غير موجود أو غير مرتبط بهذه الشركة" }, { status: 400 });
    }

    if (data.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: data.branchId, companyId: data.companyId, isActive: true },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json({ success: false, error: "الفرع المختار غير موجود أو لا يتبع هذه الشركة" }, { status: 400 });
      }
    }

    const profile = await prisma.investorSalaryFundingProfile.create({
      data: {
        companyId: data.companyId,
        investorId: data.investorId,
        branchId: data.branchId ?? null,
        workersCount: data.workersCount,
        monthlyAmount: data.monthlyAmount,
        collectionStartDay: data.collectionStartDay ?? 22,
        collectionEndDay: data.collectionEndDay ?? 31,
        whatsappTemplateAr: data.whatsappTemplateAr ?? null,
        whatsappTemplateEn: data.whatsappTemplateEn ?? null,
        isActive: data.isActive ?? true,
        notes: data.notes ?? null,
      },
    });

    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حفظ ملف تمويل الرواتب";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
