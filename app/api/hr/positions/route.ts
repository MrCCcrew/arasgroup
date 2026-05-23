import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const positions = await prisma.employeePosition.findMany({
    where: { companyId },
    include: { _count: { select: { employees: true } } },
    orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
  });
  return NextResponse.json({ success: true, data: positions });
}

const schema = z.object({
  companyId: z.string(),
  nameAr: z.string().min(2),
  nameEn: z.string().optional(),
  sortOrder: z.number().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const exists = await prisma.employeePosition.findFirst({
      where: { companyId: parsed.data.companyId, nameAr: parsed.data.nameAr },
    });
    if (exists) return NextResponse.json({ success: false, error: "الوظيفة موجودة مسبقاً" }, { status: 409 });

    const position = await prisma.employeePosition.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: position }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في الإضافة" }, { status: 500 });
  }
}
