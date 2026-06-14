import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

// دفعات تحصيل الرواتب من المسئولين — مرجعي فقط، لا يؤثر على الحسابات.
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const investorId = searchParams.get("investorId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  const accessError = assertCompanyAccess(session, companyId);
  if (accessError) return accessError;

  const batches = await prisma.managerSalaryBatch.findMany({
    where: { companyId, ...(investorId ? { investorId } : {}) },
    include: {
      investor: { select: { nameAr: true } },
      lines: { include: { employee: { select: { nameAr: true } } } },
      payments: { orderBy: { paidDate: "asc" } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    success: true,
    data: batches.map((b) => {
      const salaries = b.lines.reduce((s, l) => s + Number(l.amount), 0);
      const commission = Number(b.bankCommission);
      const total = salaries + commission;
      const collected = b.payments.reduce((s, p) => s + Number(p.amount), 0);
      return {
        id: b.id,
        investorId: b.investorId,
        investorName: b.investor.nameAr,
        month: b.month,
        year: b.year,
        bankCommission: commission,
        notes: b.notes,
        salaries,
        total,
        collected,
        remaining: total - collected,
        lines: b.lines.map((l) => ({ id: l.id, employeeId: l.employeeId, employeeName: l.employee.nameAr, amount: Number(l.amount) })),
        payments: b.payments.map((p) => ({ id: p.id, amount: Number(p.amount), paidDate: p.paidDate, notes: p.notes })),
      };
    }),
  });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  investorId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  bankCommission: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
  lines: z.array(z.object({ employeeId: z.string().min(1), amount: z.number().min(0) })).min(1, "اختر موظفاً واحداً على الأقل"),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const d = parsed.data;
    const accessError = assertCompanyAccess(session, d.companyId);
    if (accessError) return accessError;

    const batch = await prisma.managerSalaryBatch.create({
      data: {
        companyId: d.companyId,
        investorId: d.investorId,
        month: d.month,
        year: d.year,
        bankCommission: d.bankCommission,
        notes: d.notes ?? null,
        createdById: session.id,
        lines: { create: d.lines.map((l) => ({ employeeId: l.employeeId, amount: l.amount })) },
      },
    });
    return NextResponse.json({ success: true, data: { id: batch.id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل في الحفظ" }, { status: 400 });
  }
}
