import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

// مستحقات المسئولين (إيجار/مصروف/إيراد) — مرجعي فقط، لا يؤثر على الحسابات.
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const type = searchParams.get("type");
  const investorId = searchParams.get("investorId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const charges = await prisma.managerCharge.findMany({
    where: {
      companyId,
      ...(type ? { type: type as "RENT" | "EXPENSE" | "REVENUE" } : {}),
      ...(investorId ? { investorId } : {}),
    },
    include: {
      investor: { select: { nameAr: true, nameEn: true } },
      payments: { orderBy: { paidDate: "asc" } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    success: true,
    data: charges.map((c) => {
      const paid = c.payments.reduce((s, p) => s + Number(p.amount), 0);
      const amount = Number(c.amount);
      return {
        id: c.id,
        investorId: c.investorId,
        investorName: c.investor.nameAr,
        type: c.type,
        title: c.title,
        month: c.month,
        year: c.year,
        amount,
        dueDate: c.dueDate,
        notes: c.notes,
        paid,
        remaining: amount - paid,
        payments: c.payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidDate: p.paidDate, notes: p.notes })),
      };
    }),
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  investorId: z.string().min(1),
  type: z.enum(["RENT", "EXPENSE", "REVENUE"]),
  title: z.string().min(1, "البيان مطلوب"),
  month: z.number().int().min(1).max(12).nullable().optional(),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().min(0),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }
    const data = parsed.data;
    const accessError = assertCompanyAccess(session, data.companyId);
    if (accessError) return accessError;

    const charge = await prisma.managerCharge.create({
      data: {
        companyId: data.companyId,
        investorId: data.investorId,
        type: data.type,
        title: data.title,
        month: data.month ?? null,
        year: data.year,
        amount: data.amount,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes ?? null,
        createdById: session.id,
      },
    });
    return NextResponse.json({ success: true, data: { id: charge.id } }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحفظ";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
