import { prisma } from "@/lib/db";
import type { CreateJournalEntryInput, JournalEntryLineInput } from "@/lib/types";
import type { JournalEntry, JournalStatus } from "@prisma/client";
import { generateNumber } from "@/lib/utils";

/**
 * Core double-entry journal engine.
 * All financial transactions in the system route through here.
 */

/** Get or create the current fiscal year for a company */
export async function getCurrentFiscalYear(companyId: string): Promise<string> {
  const current = await prisma.fiscalYear.findFirst({
    where: { companyId, isCurrent: true },
  });
  if (current) return current.id;

  // Auto-create for current year
  const year = new Date().getFullYear();
  const created = await prisma.fiscalYear.create({
    data: {
      companyId,
      year,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-12-31`),
      isCurrent: true,
    },
  });
  return created.id;
}

const TYPE_PREFIX: Record<string, string> = {
  PAYMENT: "PV",
  RECEIPT: "RV",
  SALARY: "SA",
  END_OF_SERVICE: "ES",
  LEAVE_PAY: "LP",
  EXPENSE: "EX",
  GENERAL: "QY",
};

/** Get next journal entry number for a company, unique per type */
async function getNextJournalNumber(companyId: string, year: number, type?: string): Promise<string> {
  const prefix = TYPE_PREFIX[type ?? "GENERAL"] ?? "QY";
  // نعد الكل بما فيهم المحذوفين (soft-delete) لتجنب إعادة استخدام الأرقام
  const count = await prisma.journalEntry.count({
    where: {
      companyId,
      fiscalYear: { year },
      type: (type as never) ?? "GENERAL",
      // لا نفلتر isDeleted هنا — المحذوف يظل "يحجز" رقمه
    },
  });
  return generateNumber(prefix, year, count + 1);
}

/** Validate that debits = credits */
function validateBalance(lines: JournalEntryLineInput[]): void {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  // Use epsilon comparison for floating point
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(
      `القيد غير متوازن: إجمالي المدين ${totalDebit.toFixed(3)} ≠ إجمالي الدائن ${totalCredit.toFixed(3)}`
    );
  }
}

/** Check fiscal year is not locked */
async function checkFiscalYearNotLocked(fiscalYearId: string): Promise<void> {
  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  if (fy?.isLocked) {
    throw new Error("لا يمكن إضافة قيود على فترة مالية مغلقة");
  }
}

/** Create a journal entry with all lines in a transaction */
export async function createJournalEntry(
  input: CreateJournalEntryInput
): Promise<JournalEntry> {
  validateBalance(input.lines);

  const fiscalYearId =
    input.fiscalYearId ?? (await getCurrentFiscalYear(input.companyId));

  await checkFiscalYearNotLocked(fiscalYearId);

  const fy = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  const year = fy?.year ?? new Date().getFullYear();
  const prefix = TYPE_PREFIX[input.type ?? "GENERAL"] ?? "QY";

  const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0);

  const buildData = (number: string) => ({
    companyId: input.companyId,
    fiscalYearId,
    number,
    date: input.date,
    descriptionAr: input.descriptionAr,
    descriptionEn: input.descriptionEn,
    type: input.type,
    status: "DRAFT" as const,
    reference: input.reference,
    refModule: input.refModule,
    refId: input.refId,
    isAutomatic: input.isAutomatic ?? false,
    costCenterId: input.costCenterId,
    totalDebit,
    totalCredit,
    createdById: input.createdById,
    lines: {
      create: input.lines.map((line, idx) => ({
        accountId: line.accountId,
        descriptionAr: line.descriptionAr,
        debit: line.debit,
        credit: line.credit,
        sortOrder: idx,
        costCenterId: line.costCenterId,
        driverId: line.driverId,
        employeeId: line.employeeId,
        investorId: line.investorId,
        branchId: line.branchId,
        carWashVehicleId: line.carWashVehicleId,
      })),
    },
  });

  // محاولة الإنشاء مع إعادة المحاولة عند تعارض الأرقام (race condition أو soft-delete)
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const number = await getNextJournalNumber(input.companyId, year, input.type);

    try {
      return await prisma.journalEntry.create({
        data: buildData(number),
        include: { lines: true },
      });
    } catch (err: unknown) {
      const isUniqueViolation =
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002";

      if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
        // الرقم مستخدم بالفعل، نجرب مرة أخرى بعد إعادة حساب الرقم التالي
        console.warn(`Journal number ${number} conflict (attempt ${attempt + 1}), retrying...`);
        // إضافة القيد المحجوز مؤقتاً بنفس الرقم لتجنب التكرار في المحاولة القادمة
        // (الكاونت سيزيد بسبب قيد جديد قُبل للتو في مكان آخر)
        continue;
      }

      // أي خطأ آخر أو استنفاد المحاولات
      const typeHint = generateNumber(prefix, year, 0); // للوضوح في رسالة الخطأ
      const message =
        isUniqueViolation
          ? `تعارض في رقم القيد (${typeHint.replace("-0000", "")}-xxxx) — يرجى المحاولة مجدداً`
          : err instanceof Error
          ? err.message
          : "فشل في إنشاء القيد";
      throw new Error(message);
    }
  }

  throw new Error("تعذر إنشاء القيد بعد عدة محاولات، يرجى المحاولة مجدداً");
}

/** Post a journal entry (change status to POSTED) */
export async function postJournalEntry(
  journalEntryId: string,
  userId: string
): Promise<JournalEntry> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { fiscalYear: true },
  });

  if (!entry) throw new Error("القيد غير موجود");
  if (entry.isDeleted) throw new Error("القيد محذوف");
  if (entry.status === "POSTED") throw new Error("القيد مرحّل بالفعل");
  if (entry.fiscalYear.isLocked) throw new Error("الفترة المالية مغلقة");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "POSTED",
      postedById: userId,
      postedAt: new Date(),
    },
  });
}

/** Approve a journal entry */
export async function approveJournalEntry(
  journalEntryId: string,
  userId: string
): Promise<JournalEntry> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
  });
  if (!entry) throw new Error("القيد غير موجود");
  if (entry.status === "POSTED") throw new Error("القيد مرحّل بالفعل");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "APPROVED",
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
}

/** Soft-delete a journal entry */
export async function deleteJournalEntry(
  journalEntryId: string,
  userId: string
): Promise<void> {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
  });
  if (!entry) throw new Error("القيد غير موجود");
  if (entry.status === "POSTED") throw new Error("لا يمكن حذف قيد مرحّل");

  await prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "DELETE",
      module: "accounting",
      resourceId: journalEntryId,
      resourceType: "JournalEntry",
      journalEntryId,
    },
  });
}

/** Get account balance (debit - credit) for an account up to a date */
export async function getAccountBalance(
  accountId: string,
  companyId: string,
  upToDate?: Date
): Promise<{ debit: number; credit: number; balance: number }> {
  const where = {
    accountId,
    journalEntry: {
      companyId,
      status: "POSTED" as JournalStatus,
      isDeleted: false,
      ...(upToDate ? { date: { lte: upToDate } } : {}),
    },
  };

  const result = await prisma.journalEntryLine.aggregate({
    where,
    _sum: { debit: true, credit: true },
  });

  const debit = Number(result._sum.debit ?? 0);
  const credit = Number(result._sum.credit ?? 0);

  return { debit, credit, balance: debit - credit };
}

/** Get trial balance for a company in a date range */
export async function getTrialBalance(
  companyId: string,
  fiscalYearId: string,
  startDate?: Date,
  endDate?: Date
) {
  const accounts = await prisma.chartOfAccount.findMany({
    where: { companyId, isActive: true, isHeader: false },
    orderBy: { code: "asc" },
  });

  const dateFilter = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };

  const periodLines = await prisma.journalEntryLine.groupBy({
    by: ["accountId"],
    where: {
      journalEntry: {
        companyId,
        fiscalYearId,
        status: "POSTED",
        isDeleted: false,
        ...(startDate || endDate ? { date: dateFilter } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });

  const openingBalances = await prisma.openingBalance.findMany({
    where: { fiscalYearId, account: { companyId } },
  });

  const lineMap = new Map(periodLines.map((l) => [l.accountId, l]));
  const openingMap = new Map(openingBalances.map((o) => [o.accountId, o]));

  return accounts.map((account) => {
    const line = lineMap.get(account.id);
    const opening = openingMap.get(account.id);

    const openingDebit = Number(opening?.debit ?? 0);
    const openingCredit = Number(opening?.credit ?? 0);
    const periodDebit = Number(line?._sum?.debit ?? 0);
    const periodCredit = Number(line?._sum?.credit ?? 0);

    const closingDebit = openingDebit + periodDebit;
    const closingCredit = openingCredit + periodCredit;

    // Net balance
    const net = closingDebit - closingCredit;

    return {
      accountId: account.id,
      code: account.code,
      nameAr: account.nameAr,
      nameEn: account.nameEn,
      type: account.type,
      level: account.level,
      isHeader: account.isHeader,
      openingDebit,
      openingCredit,
      periodDebit,
      periodCredit,
      closingDebit: net > 0 ? net : 0,
      closingCredit: net < 0 ? Math.abs(net) : 0,
    };
  });
}
