import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

// قائمة الأسماء حسب النوع (سائق/موظف) للشركة الحالية — النشطين غير المحذوفين فقط.
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const type = searchParams.get("type");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  if (type === "DRIVER") {
    const drivers = await prisma.driver.findMany({
      where: { employee: { companyId, isActive: true, isDeleted: false } },
      include: { employee: { select: { nameAr: true, nameEn: true } } },
      orderBy: { employee: { nameAr: "asc" } },
    });
    return NextResponse.json({
      success: true,
      data: drivers.map((d) => ({ id: d.id, nameAr: d.employee.nameAr, nameEn: d.employee.nameEn })),
    });
  }

  if (type === "EMPLOYEE") {
    const employees = await prisma.employee.findMany({
      where: { companyId, isActive: true, isDeleted: false },
      select: { id: true, nameAr: true, nameEn: true },
      orderBy: { nameAr: "asc" },
    });
    return NextResponse.json({ success: true, data: employees });
  }

  return NextResponse.json({ success: false, error: "type يجب أن يكون DRIVER أو EMPLOYEE" }, { status: 400 });
}
