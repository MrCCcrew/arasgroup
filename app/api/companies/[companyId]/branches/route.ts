import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

interface Props {
  params: Promise<{ companyId: string }>;
}

const createSchema = z.object({
  nameAr: z.string().min(2, "اسم الفرع مطلوب"),
  nameEn: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET(request: NextRequest, { params }: Props) {
  try {
    const { companyId } = await params;

    const branches = await prisma.branch.findMany({
      where: { companyId },
      include: {
        investorBranches: {
          where: { isActive: true },
          include: { investor: { select: { nameAr: true } } },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { nameAr: "asc" }],
    });

    return NextResponse.json({ success: true, data: branches });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب الفروع" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Props) {
  try {
    const { companyId } = await params;
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const branch = await prisma.branch.create({
      data: { companyId, ...parsed.data },
    });

    return NextResponse.json({ success: true, data: branch }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء الفرع";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
