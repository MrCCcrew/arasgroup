import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ employeeId: string }>;
}

/**
 * حذف موظف نهائياً من قاعدة البيانات (hard delete).
 * يعمل فقط على الموظفين المحذوفين مسبقاً (isDeleted = true).
 */
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { employeeId } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        isDeleted: true,
        nameAr: true,
      },
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }

    if (!employee.isDeleted) {
      return NextResponse.json(
        { success: false, error: "لا يمكن الحذف النهائي إلا للموظفين المحذوفين مسبقاً" },
        { status: 400 }
      );
    }

    const companyAccessError = assertCompanyAccess(session, employee.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "HR", "DELETE", {
      companyId: employee.companyId,
      branchId: employee.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    // حذف نهائي من قاعدة البيانات
    await prisma.employee.delete({
      where: { id: employeeId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PERMANENT_DELETE_EMPLOYEE_ERROR", error);

    // التحقق من وجود foreign key constraints
    if (error instanceof Error && error.message.includes("Foreign key constraint")) {
      return NextResponse.json(
        {
          success: false,
          error: "لا يمكن حذف الموظف نهائياً لوجود بيانات مرتبطة به (رواتب، سلف، مخالفات، إلخ). يرجى حذف البيانات المرتبطة أولاً أو الاحتفاظ بالموظف محذوفاً فقط."
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "فشل في حذف الموظف نهائياً" },
      { status: 500 }
    );
  }
}
