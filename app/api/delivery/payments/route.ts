import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");
    if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const payments = await prisma.companyPayment.findMany({
      where: { companyId },
      include: {
        contract: { select: { nameAr: true, nameEn: true, platform: true } },
        bankAccount: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { receivedDate: "desc" },
    });

    return NextResponse.json({ success: true, data: payments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب المدفوعات" }, { status: 500 });
  }
}

const createSchema = z.object({
  companyId: z.string().min(1),
  contractId: z.string().optional(),
  platform: z.string().optional().nullable(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020),
  grossAmount: z.number().min(0),
  walletDeductions: z.number().min(0).default(0),
  netReceived: z.number(),
  receivedDate: z.string().transform((s) => new Date(s)),
  bankAccountId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;
    const companyAccessError = assertCompanyAccess(session, data.companyId);
    if (companyAccessError) return companyAccessError;

    const payment = await prisma.companyPayment.create({
      data: {
        companyId: data.companyId,
        contractId: data.contractId,
        platform: data.platform,
        month: data.month,
        year: data.year,
        grossAmount: data.grossAmount,
        walletDeductions: data.walletDeductions,
        netReceived: data.netReceived,
        receivedDate: data.receivedDate,
        bankAccountId: data.bankAccountId,
        notes: data.notes,
        status: "RECEIVED",
      },
    });

    return NextResponse.json({ success: true, data: payment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في تسجيل الدفعة" }, { status: 500 });
  }
}
