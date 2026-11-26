import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { contractFields, contractInputError } from "@/lib/delivery/contract-input";

const createSchema = contractFields.extend({ companyId: z.string().min(1) });

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
    const denied = assertCompanyAccess(session, companyId);
    if (denied) return denied;

    const contracts = await prisma.deliveryContract.findMany({
      where: { companyId, isActive: true },
      include: { _count: { select: { hourlyWorkEntries: true } } },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({ success: true, data: contracts });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في جلب العقود";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const denied = assertCompanyAccess(session, parsed.data.companyId) || assertPermission(session, "DELIVERY_OPERATIONS", "CREATE", { companyId: parsed.data.companyId });
    if (denied) return denied;
    const error = contractInputError({ ...parsed.data, usesHourlyWork: parsed.data.usesHourlyWork ?? false });
    if (error) return NextResponse.json({ success: false, error }, { status: 400 });
    const contract = await prisma.deliveryContract.create({ data: parsed.data });
    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء العقد";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
