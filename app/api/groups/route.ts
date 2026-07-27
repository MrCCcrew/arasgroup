import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await requireRequestSession(request);
    if (session instanceof NextResponse) return session;
    const groups = await prisma.group.findMany({
      where: session.isSuperAdmin || session.hasGlobalGroupAccess ? {} : { companies: { some: { id: { in: session.companyAccess } } } },
      include: { companies: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ success: true, data: groups, hasGlobalAccess: session.isSuperAdmin || session.hasGlobalGroupAccess });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب المجموعات" }, { status: 500 });
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
    const { nameAr, nameEn, address, phone, email } = body;
    if (!nameAr) {
      return NextResponse.json({ success: false, error: "اسم المجموعة مطلوب" }, { status: 400 });
    }
    const group = await prisma.group.create({
      data: { nameAr, nameEn, address, phone, email },
    });
    return NextResponse.json({ success: true, data: group }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء المجموعة";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
