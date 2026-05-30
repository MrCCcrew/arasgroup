import type { JournalEntry, JournalStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CreateJournalEntryInput, JournalEntryLineInput } from "@/lib/types";
import { generateNumber } from "@/lib/utils";

const TYPE_PREFIX: Record<string, string> = {
  PAYMENT: "PV",
  RECEIPT: "RV",
  SALARY: "SA",
  END_OF_SERVICE: "ES",
  LEAVE_PAY: "LP",
  EXPENSE: "EX",
  GENERAL: "QY",
};

export async function getCurrentFiscalYear(companyId: string): Promise<string> {
  const current = await prisma.fiscalYear.findFirst({
    where: { companyId, isCurrent: true },
  });
  if (current) return current.id;

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

async function getNextJournalNumber(companyId: string, year: number, type?: string): Promise<string> {
  const prefix = TYPE_PREFIX[type ?? "GENERAL"] ?? "QY";
  const count = await prisma.journalEntry.count({
    where: {
      companyId,
      fiscalYear: { year },
      type: (type as never) ?? "GENERAL",
    },
  });

  return generateNumber(prefix, year, count + 1);
}

function validateBalance(lines: JournalEntryLineInput[]): void {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`القيد غير متوازن: إجمالي المدين ${totalDebit.toFixed(3)} لا يساوي إجمالي الدائن ${totalCredit.toFixed(3)}`);
  }
}

async function checkFiscalYearNotLocked(fiscalYearId: string): Promise<void> {
  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  if (fiscalYear?.isLocked) {
    throw new Error("لا يمكن إضافة قيود على فترة مالية مغلقة");
  }
}

async function getMutableJournalEntry(journalEntryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: journalEntryId },
    include: { fiscalYear: true },
  });

  if (!entry) throw new Error("القيد غير موجود");
  if (entry.isDeleted) throw new Error("القيد محذوف");
  if (entry.fiscalYear.isLocked) throw new Error("الفترة المالية مغلقة");

  return entry;
}

function ensureTransition(currentStatus: JournalStatus, allowedStatuses: JournalStatus[], actionLabel: string): void {
  if (!allowedStatuses.includes(currentStatus)) {
    throw new Error(`لا يمكن ${actionLabel} عندما تكون الحالة الحالية ${currentStatus}`);
  }
}

function buildStatusResetData(status: JournalStatus) {
  if (status === "DRAFT") {
    return {
      approvedById: null,
      approvedAt: null,
      postedById: null,
      postedAt: null,
    };
  }

  if (status === "PENDING_APPROVAL" || status === "REJECTED" || status === "CANCELLED") {
    return {
      postedById: null,
      postedAt: null,
    };
  }

  return {};
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  validateBalance(input.lines);

  const fiscalYearId = input.fiscalYearId ?? (await getCurrentFiscalYear(input.companyId));
  await checkFiscalYearNotLocked(fiscalYearId);

  const fiscalYear = await prisma.fiscalYear.findUnique({ where: { id: fiscalYearId } });
  const year = fiscalYear?.year ?? new Date().getFullYear();
  const prefix = TYPE_PREFIX[input.type ?? "GENERAL"] ?? "QY";
  const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

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
      create: input.lines.map((line, index) => ({
        accountId: line.accountId,
        descriptionAr: line.descriptionAr,
        debit: line.debit,
        credit: line.credit,
        sortOrder: index,
        costCenterId: line.costCenterId,
        driverId: line.driverId,
        employeeId: line.employeeId,
        investorId: line.investorId,
        branchId: line.branchId,
        carWashVehicleId: line.carWashVehicleId,
      })),
    },
  });

  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const number = await getNextJournalNumber(input.companyId, year, input.type);

    try {
      return await prisma.journalEntry.create({
        data: buildData(number),
        include: { lines: true },
      });
    } catch (error: unknown) {
      const isUniqueViolation =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: string }).code === "P2002";

      if (isUniqueViolation && attempt < maxRetries - 1) {
        console.warn(`Journal number ${number} conflict (attempt ${attempt + 1}), retrying...`);
        continue;
      }

      const typeHint = generateNumber(prefix, year, 0);
      const message = isUniqueViolation
        ? `تعارض في رقم القيد (${typeHint.replace("-0000", "")}-xxxx) - يرجى المحاولة مجددًا`
        : error instanceof Error
        ? error.message
        : "فشل في إنشاء القيد";
      throw new Error(message);
    }
  }

  throw new Error("تعذر إنشاء القيد بعد عدة محاولات، يرجى المحاولة مجددًا");
}

export async function submitJournalEntryForApproval(journalEntryId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["DRAFT", "REJECTED"], "إرسال القيد للموافقة");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "PENDING_APPROVAL",
      ...buildStatusResetData("PENDING_APPROVAL"),
    },
  });
}

export async function approveJournalEntry(journalEntryId: string, userId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["DRAFT", "PENDING_APPROVAL"], "اعتماد القيد");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "APPROVED",
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
}

export async function rejectJournalEntry(journalEntryId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["PENDING_APPROVAL"], "رفض القيد");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "REJECTED",
      approvedById: null,
      approvedAt: null,
      ...buildStatusResetData("REJECTED"),
    },
  });
}

export async function revertJournalEntryToDraft(journalEntryId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"], "إرجاع القيد إلى المسودة");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "DRAFT",
      ...buildStatusResetData("DRAFT"),
    },
  });
}

export async function postJournalEntry(journalEntryId: string, userId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["DRAFT", "PENDING_APPROVAL", "APPROVED"], "ترحيل القيد");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "POSTED",
      postedById: userId,
      postedAt: new Date(),
    },
  });
}

export async function cancelJournalEntry(journalEntryId: string): Promise<JournalEntry> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"], "إلغاء القيد");

  return prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: "CANCELLED",
      ...buildStatusResetData("CANCELLED"),
    },
  });
}

export async function deleteJournalEntry(journalEntryId: string, userId: string): Promise<void> {
  const entry = await getMutableJournalEntry(journalEntryId);
  ensureTransition(entry.status, ["DRAFT", "REJECTED", "CANCELLED"], "حذف القيد");

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

export async function getAccountBalance(
  accountId: string,
  companyId: string,
  upToDate?: Date,
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

export async function getTrialBalance(
  companyId: string,
  fiscalYearId: string,
  startDate?: Date,
  endDate?: Date,
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

  const lineMap = new Map(periodLines.map((line) => [line.accountId, line]));
  const openingMap = new Map(openingBalances.map((opening) => [opening.accountId, opening]));

  return accounts.map((account) => {
    const line = lineMap.get(account.id);
    const opening = openingMap.get(account.id);
    const openingDebit = Number(opening?.debit ?? 0);
    const openingCredit = Number(opening?.credit ?? 0);
    const periodDebit = Number(line?._sum?.debit ?? 0);
    const periodCredit = Number(line?._sum?.credit ?? 0);
    const closingDebit = openingDebit + periodDebit;
    const closingCredit = openingCredit + periodCredit;
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
