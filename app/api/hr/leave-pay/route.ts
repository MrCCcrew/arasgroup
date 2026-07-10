import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";
import { createJournalEntry } from "@/lib/accounting/journal-engine";
import type { JournalEntryType } from "@prisma/client";

// Kuwait Labor Law: 30 days/year for <5 years, 35 days for 5+ years
function calcLeaveDays(joinDate: Date, asOfDate: Date): number {
  const years = (asOfDate.getTime() - joinDate.getTime()) / (365 * 86400000);
  return years >= 5 ? 35 : 30;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const records = await prisma.leavePayCalc.findMany({
    where: { companyId },
    include: { employee: { select: { nameAr: true, employeeNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: records });
}

const createSchema = z.object({
  companyId: z.string(),
  employeeId: z.string(),
  year: z.number().int(),
  periodStartDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  periodEndDate: z.string().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  leaveDaysUsed: z.number().min(0).default(0),
  daysOwed: z.number().min(0),
  daysPaid: z.number().min(0),
  dailyWage: z.number().min(0),
  totalAmount: z.number().min(0),
  notes: z.string().nullable().optional(),
  action: z.enum(["CALCULATE", "ACCRUE", "PAY"]).default("CALCULATE"),
  paymentMethod: z.enum(["CASH", "BANK"]).nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const data = parsed.data;

    const employee = await prisma.employee.findFirst({ where: { id: data.employeeId, isDeleted: false } });
    if (!employee) return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });

    const asOfDate = new Date(data.year, 11, 31);

    const record = await prisma.leavePayCalc.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        year: data.year,
        periodStartDate: data.periodStartDate,
        periodEndDate: data.periodEndDate,
        leaveDaysOwed: data.daysOwed,
        leaveDaysUsed: data.leaveDaysUsed,
        leaveDaysPaid: data.daysPaid,
        dailyWage: data.dailyWage,
        totalAmount: data.totalAmount,
        status: data.action === "CALCULATE" ? "CALCULATED" : data.action === "ACCRUE" ? "ACCRUED" : "PAID",
        notes: data.notes,
        paidDate: data.action === "PAY" ? new Date() : undefined,
        createdById: userId,
      },
    });

    if (data.action !== "CALCULATE") {
      const accounts = await prisma.chartOfAccount.findMany({
        where: { companyId: data.companyId, isActive: true, isHeader: false },
      });
      const expenseAcc = accounts.find((a) => a.nameAr.includes("إجازة") || (a.code.startsWith("5") && a.nameAr.includes("رواتب")));
      const liabilityAcc = accounts.find((a) => a.nameAr.includes("مستحقات") && a.code.startsWith("2"));
      const cashAcc = accounts.find((a) => a.code.startsWith("1001"));
      const bankAcc = data.bankAccountId
        ? await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId }, include: { chartAccount: true } })
        : null;

      if (data.action === "ACCRUE" && expenseAcc && liabilityAcc) {
        const je = await createJournalEntry({
          companyId: data.companyId,
          createdById: userId,
          date: asOfDate,
          descriptionAr: `استحقاق بدل إجازة ${data.year} — ${employee.nameAr}`,
          type: "EXPENSE" as JournalEntryType,
          refModule: "LEAVE_PAY",
          refId: record.id,
          isAutomatic: true,
          lines: [
            { accountId: expenseAcc.id, debit: data.totalAmount, credit: 0, descriptionAr: `بدل إجازة ${data.year}` },
            { accountId: liabilityAcc.id, debit: 0, credit: data.totalAmount, descriptionAr: `مستحقات — ${employee.nameAr}` },
          ],
        });
        await prisma.leavePayCalc.update({ where: { id: record.id }, data: { journalEntryId: je.id } });
      } else if (data.action === "PAY") {
        const crAccountId = bankAcc?.chartAccount?.id ?? cashAcc?.id;
        if (expenseAcc && crAccountId) {
          const je = await createJournalEntry({
            companyId: data.companyId,
            createdById: userId,
            date: new Date(),
            descriptionAr: `صرف بدل إجازة ${data.year} — ${employee.nameAr}`,
            type: "PAYMENT" as JournalEntryType,
            refModule: "LEAVE_PAY",
            refId: record.id,
            isAutomatic: true,
            lines: [
              { accountId: expenseAcc.id, debit: data.totalAmount, credit: 0, descriptionAr: `بدل إجازة ${data.year}` },
              { accountId: crAccountId, debit: 0, credit: data.totalAmount, descriptionAr: `صرف لـ ${employee.nameAr}` },
            ],
          });
          await prisma.leavePayCalc.update({ where: { id: record.id }, data: { journalEntryId: je.id } });
        }
      }
    }

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحفظ";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
