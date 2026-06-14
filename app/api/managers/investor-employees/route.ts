import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

// موظفو مسئول معيّن (مرتبطون به عبر investorId حتى لو من ترخيص آخر) — لاختيارهم في تحصيل الرواتب.
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const investorId = searchParams.get("investorId");
  if (!companyId || !investorId) {
    return NextResponse.json({ success: false, error: "companyId و investorId مطلوبان" }, { status: 400 });
  }
  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const employees = await prisma.employee.findMany({
    where: { investorId, isDeleted: false },
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      baseSalary: true,
      actualSalary: true,
      license: { select: { commercialNameAr: true } },
    },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({
    success: true,
    data: employees.map((e) => ({
      id: e.id,
      nameAr: e.nameAr,
      nameEn: e.nameEn,
      salary: Number(e.actualSalary ?? e.baseSalary ?? 0),
      licenseName: e.license?.commercialNameAr ?? null,
    })),
  });
}
