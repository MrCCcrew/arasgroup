import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ groupId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const { groupId } = await params;
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { companies: { orderBy: { sortOrder: "asc" } } },
    });
    if (!group) return NextResponse.json({ success: false, error: "المجموعة غير موجودة" }, { status: 404 });
    return NextResponse.json({ success: true, data: group });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب المجموعة" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });

  try {
    const { groupId } = await params;
    const { nameAr, nameEn, address, phone, email } = await request.json();
    if (!nameAr) return NextResponse.json({ success: false, error: "اسم المجموعة مطلوب" }, { status: 400 });

    const group = await prisma.group.update({
      where: { id: groupId },
      data: { nameAr, nameEn, address, phone, email },
    });
    return NextResponse.json({ success: true, data: group });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث المجموعة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });

  try {
    const { groupId } = await params;

    const companiesCount = await prisma.company.count({ where: { groupId } });
    if (companiesCount > 0) {
      return NextResponse.json(
        { success: false, error: "لا يمكن حذف مجموعة تحتوي على شركات — انقل الشركات أولاً" },
        { status: 400 }
      );
    }

    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف المجموعة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
