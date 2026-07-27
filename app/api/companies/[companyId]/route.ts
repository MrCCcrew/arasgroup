import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ companyId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  try {
    const session = await requireRequestSession(_req);
    if (session instanceof NextResponse) return session;
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: { group: true },
    });
    if (!company) return NextResponse.json({ success: false, error: "الشركة غير موجودة" }, { status: 404 });
    if (!session.isSuperAdmin && !session.companyAccess.includes(companyId)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    return NextResponse.json({ success: true, data: company });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب الشركة" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {

    const { companyId } = await params;
    const body = await request.json();
    const {
      nameAr, nameEn, type, commercialReg, address, phone, email,
      isActive, sortOrder,
      // Group change options
      groupId,           // move to existing group
      newGroupNameAr,    // create new group and move there
    } = body;

    let targetGroupId = groupId;

    // If creating a new group for this company (separating it)
    if (newGroupNameAr) {
      const newGroup = await prisma.group.create({
        data: { nameAr: newGroupNameAr },
      });
      targetGroupId = newGroup.id;
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(nameAr !== undefined ? { nameAr } : {}),
        ...(nameEn !== undefined ? { nameEn } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(commercialReg !== undefined ? { commercialReg } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(targetGroupId ? { groupId: targetGroupId } : {}),
      },
      include: { group: true },
    });

    return NextResponse.json({ success: true, data: company });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث الشركة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { companyId } = await params;

    // Check for any related data that would block deletion
    const [employees, journalEntries, expenses] = await Promise.all([
      prisma.employee.count({ where: { companyId, isDeleted: false } }),
      prisma.journalEntry.count({ where: { companyId, isDeleted: false } }),
      prisma.expense.count({ where: { companyId, isDeleted: false } }),
    ]);

    if (employees > 0 || journalEntries > 0 || expenses > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `لا يمكن حذف الشركة — تحتوي على: ${[
            employees > 0 ? `${employees} موظف` : "",
            journalEntries > 0 ? `${journalEntries} قيد محاسبي` : "",
            expenses > 0 ? `${expenses} مصروف` : "",
          ].filter(Boolean).join("، ")}`,
        },
        { status: 400 }
      );
    }

    // Soft delete — mark inactive rather than hard delete
    await prisma.company.update({
      where: { id: companyId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الشركة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
