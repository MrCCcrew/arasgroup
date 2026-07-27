import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createCompanySchema = z.object({
  groupId: z.string(),
  nameAr: z.string().min(2, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  type: z.enum(["DELIVERY", "CAR_WASH", "TRADING", "HOLDING", "OTHER", "OWNER_MANAGED"]),
  commercialReg: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        ...(session.isSuperAdmin ? {} : { id: { in: session.companyAccess } }),
      },
      include: {
        group: { select: { nameAr: true, nameEn: true } },
        bankAccounts: { where: { isActive: true }, select: { id: true, nameAr: true, bankName: true, accountNumber: true } },
        _count: { select: { branches: true, employees: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ success: true, data: companies });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب الشركات" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const company = await prisma.company.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: company }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في إنشاء الشركة" }, { status: 500 });
  }
}
