import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { z } from "zod";
import { createJournalEntry } from "@/lib/accounting/journal-engine";
import type { JournalEntryType } from "@prisma/client";

// Kuwait Labor Law No. 6/2010 - Article 51
function calcIndemnity(joinDate: Date, lastDay: Date, monthlySalary: number, terminationType: string) {
  const msPerDay = 86400000;
  const totalDays = Math.floor((lastDay.getTime() - joinDate.getTime()) / msPerDay);
  const serviceYears = totalDays / 365;

  // Daily wage = monthly salary / 26
  const dailyWage = monthlySalary / 26;

  // Gross indemnity: first 5 years = 15 days/year, above 5 = 30 days/year
  let grossDays = 0;
  if (serviceYears <= 5) {
    grossDays = serviceYears * 15;
  } else {
    grossDays = 5 * 15 + (serviceYears - 5) * 30;
  }

  // Resignation deduction based on tenure
  let deductionPct = 100;
  if (terminationType === "RESIGNATION") {
    if (serviceYears < 3) deductionPct = 0;
    else if (serviceYears < 5) deductionPct = 50;
    else if (serviceYears < 10) deductionPct = 75;
    else deductionPct = 100;
  }

  const grossIndemnity = grossDays * dailyWage;
  const netIndemnity = (grossIndemnity * deductionPct) / 100;

  return {
    serviceDays: totalDays,
    serviceYears: Math.round(serviceYears * 100) / 100,
    dailyWage: Math.round(dailyWage * 1000) / 1000,
    grossIndemnity: Math.round(grossIndemnity * 1000) / 1000,
    deductionPct,
    netIndemnity: Math.round(netIndemnity * 1000) / 1000,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const records = await prisma.endOfServiceCalc.findMany({
    where: { companyId },
    include: { employee: { select: { nameAr: true, employeeNumber: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: records });
}

const createSchema = z.object({
  companyId: z.string(),
  employeeId: z.string(),
  terminationType: z.enum(["RESIGNATION", "TERMINATION", "RETIREMENT", "DEATH"]),
  lastWorkingDay: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
  // Accounting
  action: z.enum(["CALCULATE", "ACCRUE", "PAY"]).default("CALCULATE"),
  paymentMethod: z.enum(["CASH", "BANK"]).optional(),
  bankAccountId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const userId = session.id;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });

    const data = parsed.data;

    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, isDeleted: false },
    });
    if (!employee) return NextResponse.json({ success: false, error: "الموظف غير موجود" }, { status: 404 });
    if (!employee.baseSalary) return NextResponse.json({ success: false, error: "الموظف لا يملك راتب أساسي مسجل" }, { status: 400 });
    if (!employee.joinDate) return NextResponse.json({ success: false, error: "تاريخ الالتحاق غير مسجل للموظف" }, { status: 400 });

    const calc = calcIndemnity(
      employee.joinDate,
      data.lastWorkingDay,
      Number(employee.baseSalary),
      data.terminationType
    );

    if (calc.serviceDays < 365) {
      return NextResponse.json({ success: false, error: "مدة الخدمة أقل من سنة — لا يستحق مكافأة" }, { status: 400 });
    }

    const record = await prisma.endOfServiceCalc.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        terminationType: data.terminationType,
        joinDate: employee.joinDate,
        lastWorkingDay: data.lastWorkingDay,
        serviceYears: calc.serviceYears,
        serviceDays: calc.serviceDays,
        dailyWage: calc.dailyWage,
        grossIndemnity: calc.grossIndemnity,
        deductionPct: calc.deductionPct,
        netIndemnity: calc.netIndemnity,
        status: data.action === "CALCULATE" ? "CALCULATED" : data.action === "ACCRUE" ? "ACCRUED" : "PAID",
        notes: data.notes,
        paidDate: data.action === "PAY" ? new Date() : undefined,
        createdById: userId,
      },
    });

    // Create journal entry if ACCRUE or PAY
    if (data.action !== "CALCULATE") {
      const accounts = await prisma.chartOfAccount.findMany({
        where: {
          companyId: data.companyId,
          isActive: true,
          isHeader: false,
          OR: [
            { code: { startsWith: "5" } }, // expenses
            { code: { startsWith: "2" } }, // liabilities
            { code: { startsWith: "1001" } }, // cash
            { code: { startsWith: "1010" } }, // bank
          ],
        },
      });

      const expenseAcc = accounts.find((a) => a.nameAr.includes("مكافأة") || (a.code.startsWith("5") && a.nameAr.includes("رواتب")));
      const liabilityAcc = accounts.find((a) => a.nameAr.includes("مستحقات") && a.code.startsWith("2"));
      const cashAcc = accounts.find((a) => a.code === "1001" || (a.code.startsWith("1001")));
      const bankAcc = data.bankAccountId
        ? await prisma.bankAccount.findFirst({ where: { id: data.bankAccountId }, include: { chartAccount: true } })
        : null;

      if (data.action === "ACCRUE" && expenseAcc && liabilityAcc) {
        const je = await createJournalEntry({
          companyId: data.companyId,
          createdById: userId,
          date: data.lastWorkingDay,
          descriptionAr: `مكافأة نهاية خدمة — ${employee.nameAr}`,
          type: "EXPENSE" as JournalEntryType,
          refModule: "END_OF_SERVICE",
          refId: record.id,
          isAutomatic: true,
          lines: [
            { accountId: expenseAcc.id, debit: calc.netIndemnity, credit: 0, descriptionAr: "مكافأة نهاية خدمة" },
            { accountId: liabilityAcc.id, debit: 0, credit: calc.netIndemnity, descriptionAr: `مستحقات — ${employee.nameAr}` },
          ],
        });
        await prisma.endOfServiceCalc.update({ where: { id: record.id }, data: { journalEntryId: je.id } });
      } else if (data.action === "PAY") {
        const crAccountId = bankAcc?.chartAccount?.id ?? cashAcc?.id;
        if (expenseAcc && crAccountId) {
          const je = await createJournalEntry({
            companyId: data.companyId,
            createdById: userId,
            date: new Date(),
            descriptionAr: `صرف مكافأة نهاية خدمة — ${employee.nameAr}`,
            type: "PAYMENT" as JournalEntryType,
            refModule: "END_OF_SERVICE",
            refId: record.id,
            isAutomatic: true,
            lines: [
              { accountId: expenseAcc.id, debit: calc.netIndemnity, credit: 0, descriptionAr: "مكافأة نهاية خدمة" },
              { accountId: crAccountId, debit: 0, credit: calc.netIndemnity, descriptionAr: `صرف لـ ${employee.nameAr}` },
            ],
          });
          await prisma.endOfServiceCalc.update({ where: { id: record.id }, data: { journalEntryId: je.id } });
        }
      }
    }

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحفظ";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
