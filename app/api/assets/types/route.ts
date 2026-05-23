import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const types = await prisma.assetItemType.findMany({
    where: { companyId, isActive: true },
    include: { _count: { select: { assetItems: true } } },
    orderBy: { nameAr: "asc" },
  });

  return NextResponse.json({ success: true, data: types });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().optional(),
  requiresSerialNumber: z.boolean().default(false),
  requiresCondition: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const companyAccessError = assertCompanyAccess(session, parsed.data.companyId);
  if (companyAccessError) return companyAccessError;

  try {
    const type = await prisma.assetItemType.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: type }, { status: 201 });
  } catch (error: unknown) {
    const isUniqueViolation = typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
    if (isUniqueViolation) {
      return NextResponse.json({ success: false, error: "هذا النوع موجود مسبقاً" }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: "فشل في إنشاء النوع" }, { status: 500 });
  }
}
