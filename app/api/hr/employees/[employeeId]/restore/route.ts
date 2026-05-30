import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ employeeId: string }>;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { employeeId } = await params;
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, companyId: true, branchId: true, isDeleted: true },
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    }

    const companyAccessError = assertCompanyAccess(session, employee.companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "HR", "UPDATE", {
      companyId: employee.companyId,
      branchId: employee.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    if (!employee.isDeleted) {
      return NextResponse.json({ success: false, error: "الموظف ليس ضمن المحذوفين" }, { status: 400 });
    }

    const restored = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        isDeleted: false,
        deletedAt: null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: restored });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في استعادة الموظف" }, { status: 500 });
  }
}
