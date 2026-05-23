import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

interface Props {
  params: Promise<{ contractId: string }>;
}

const updateSchema = z.object({
  platform: z.enum(["TALABAT", "RO_POPS"]).optional(),
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional().nullable(),
  startDate: z.string().optional().transform((s) => s ? new Date(s) : undefined),
  endDate: z.string().optional().nullable().transform((s) => s ? new Date(s) : s === null ? null : undefined),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const contract = await prisma.deliveryContract.update({
      where: { id: contractId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { contractId } = await params;

    const reportCount = await prisma.deliveryMonthlyReport.count({ where: { contractId } });
    if (reportCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف العقد — مرتبط بـ ${reportCount} تقرير شهري` },
        { status: 400 }
      );
    }

    await prisma.deliveryContract.update({
      where: { id: contractId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
