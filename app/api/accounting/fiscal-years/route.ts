import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const createFYSchema = z.object({
  companyId: z.string(),
  year: z.number().int().min(2020).max(2100),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().transform((s) => new Date(s)),
  isCurrent: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const fiscalYears = await prisma.fiscalYear.findMany({
      where: { companyId },
      orderBy: { year: "desc" },
    });

    return NextResponse.json({ success: true, data: fiscalYears });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب السنوات المالية" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = createFYSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, parsed.data.companyId);
    if (companyAccessError) return companyAccessError;

    const permissionError = assertPermission(session, "ACCOUNTING", "CREATE", {
      companyId: parsed.data.companyId,
    });
    if (permissionError) return permissionError;

    if (parsed.data.isCurrent) {
      await prisma.fiscalYear.updateMany({
        where: { companyId: parsed.data.companyId },
        data: { isCurrent: false },
      });
    }

    const fiscalYear = await prisma.fiscalYear.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: fiscalYear }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في إنشاء السنة المالية" }, { status: 500 });
  }
}
