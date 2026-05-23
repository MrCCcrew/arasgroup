import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const status = searchParams.get("status") ?? undefined;

  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const items = await prisma.assetItem.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
    },
    include: {
      assetItemType: { select: { nameAr: true, nameEn: true } },
      custodies: {
        where: { status: "ACTIVE" },
        take: 1,
        include: {
          employee: {
            select: { nameAr: true, nameEn: true },
          },
          driver: {
            select: { employee: { select: { nameAr: true, nameEn: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: items });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().optional(),
  assetItemTypeId: z.string().min(1),
  nameAr: z.string().min(1),
  nameEn: z.string().optional(),
  serialNumber: z.string().optional(),
  barcode: z.string().optional(),
  purchaseDate: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  purchaseCost: z.number().min(0).optional(),
  currentCondition: z.enum(["NEW", "GOOD", "USED", "DAMAGED", "LOST", "UNDER_MAINTENANCE"]).default("NEW"),
  notes: z.string().optional(),
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
    const item = await prisma.assetItem.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في إنشاء الصنف" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });

  const item = await prisma.assetItem.findFirst({
    where: { id, deletedAt: null },
    select: { companyId: true, status: true },
  });
  if (!item) return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });

  const companyAccessError = assertCompanyAccess(session, item.companyId);
  if (companyAccessError) return companyAccessError;

  if (item.status === "ASSIGNED") {
    return NextResponse.json({ success: false, error: "لا يمكن حذف صنف مُسلَّم حالياً" }, { status: 409 });
  }

  await prisma.assetItem.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ success: true });
}
