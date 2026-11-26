import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ profileId: string }>;
}

const schema = z.object({
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

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;
    const { profileId } = await params;

    const profile = await prisma.investorSalaryFundingProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return NextResponse.json({ success: false, error: "ملف تمويل الرواتب غير موجود" }, { status: 404 });
    }

    const permissionError = assertPermission(session, "INVESTORS", "UPDATE", {
      companyId: profile.companyId,
      branchId: profile.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: parsed.data.branchId, companyId: profile.companyId, isActive: true },
        select: { id: true },
      });
      if (!branch) {
        return NextResponse.json({ success: false, error: "الفرع المختار غير موجود أو لا يتبع هذه الشركة" }, { status: 400 });
      }
    }

    const updated = await prisma.investorSalaryFundingProfile.update({
      where: { id: profileId },
      data: {
        branchId: parsed.data.branchId ?? null,
        workersCount: parsed.data.workersCount,
        monthlyAmount: parsed.data.monthlyAmount,
        collectionStartDay: parsed.data.collectionStartDay ?? profile.collectionStartDay,
        collectionEndDay: parsed.data.collectionEndDay ?? profile.collectionEndDay,
        whatsappTemplateAr: parsed.data.whatsappTemplateAr ?? null,
        whatsappTemplateEn: parsed.data.whatsappTemplateEn ?? null,
        isActive: parsed.data.isActive ?? profile.isActive,
        notes: parsed.data.notes ?? null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تحديث ملف تمويل الرواتب";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;
    const { profileId } = await params;

    const profile = await prisma.investorSalaryFundingProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      return NextResponse.json({ success: false, error: "ملف تمويل الرواتب غير موجود" }, { status: 404 });
    }

    const permissionError = assertPermission(session, "INVESTORS", "UPDATE", {
      companyId: profile.companyId,
      branchId: profile.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    await prisma.investorSalaryFundingProfile.delete({ where: { id: profileId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في حذف ملف تمويل الرواتب";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
