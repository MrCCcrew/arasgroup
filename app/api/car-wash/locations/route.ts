import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const locations = await prisma.carWashLocation.findMany({
    where: { companyId, isActive: true },
    select: { id: true, nameAr: true, nameEn: true, locationType: true },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({ success: true, data: locations });
}
