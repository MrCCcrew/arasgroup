import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

interface Props {
  params: Promise<{ categoryId: string }>;
}

const updateSchema = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  code: z.string().optional(),
  type: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  try {
    const { categoryId } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const category = await prisma.expenseCategory.update({
      where: { id: categoryId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث الفئة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Props) {
  try {
    const { categoryId } = await params;

    const expensesCount = await prisma.expense.count({
      where: { categoryId, isDeleted: false },
    });

    if (expensesCount > 0) {
      return NextResponse.json(
        { success: false, error: `لا يمكن حذف الفئة — تحتوي على ${expensesCount} مصروف. يمكنك إلغاء تفعيلها بدلاً من الحذف.` },
        { status: 400 }
      );
    }

    await prisma.expenseCategory.delete({ where: { id: categoryId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الفئة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
