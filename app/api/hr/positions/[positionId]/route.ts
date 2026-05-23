import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

interface Ctx { params: Promise<{ positionId: string }> }

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { positionId } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const position = await prisma.employeePosition.update({ where: { id: positionId }, data: parsed.data });
    return NextResponse.json({ success: true, data: position });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في التحديث" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { positionId } = await params;
    const count = await prisma.employee.count({ where: { positionId } });
    if (count > 0) return NextResponse.json({ success: false, error: `لا يمكن الحذف — مرتبط بـ ${count} موظف` }, { status: 409 });

    await prisma.employeePosition.delete({ where: { id: positionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الحذف" }, { status: 500 });
  }
}
