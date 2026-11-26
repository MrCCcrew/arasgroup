import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { claimAmounts, contractBalances, money, movementLines } from "./calculations";
import { inputSchema } from "./input";
import type { z } from "zod";

type Input = z.infer<typeof inputSchema>;
type Tx = Prisma.TransactionClient;
async function projectFor(tx: Tx, companyId: string, projectId: string) {
  const project = await tx.constructionProject.findFirst({ where: { id: projectId, companyId } });
  if (!project) throw new Error("المشروع غير موجود في هذه الشركة");
  return project;
}
const liveJournal = { isDeleted: false, isReversed: false, status: { notIn: ["CANCELLED", "REJECTED"] as ("CANCELLED" | "REJECTED")[] } };
async function amountsFor(tx: Tx, projectId: string, row: { kind: string; contractId?: string | null; amount: Prisma.Decimal.Value; date: Date }) {
  if (row.kind === "COST") return { amount: money(row.amount), retention: money(0), advanceRecovery: money(0), netAmount: money(row.amount) };
  const contract = await tx.constructionContract.findFirst({ where: { id: row.contractId ?? "", projectId } });
  if (!contract) throw new Error("اختر عقدًا تابعًا للمشروع");
  const previous = await tx.constructionDocument.findMany({ where: { contractId: contract.id, status: "APPROVED", journalEntry: liveJournal } });
  if (previous.some(p => p.date > row.date)) throw new Error("تاريخ الحركة يسبق حركة معتمدة للعقد؛ استخدم تاريخًا لاحقًا أو صحح الحركة السابقة أولًا");
  const balance = contractBalances(previous);
  const amount = money(row.amount);
  if (row.kind === "CLAIM") {
    if (balance.claimed.add(amount).gt(contract.value)) throw new Error("إجمالي المستخلصات يتجاوز قيمة العقد");
    return claimAmounts(amount, contract.retentionPercent, contract.advanceRecoveryPercent, balance.advance);
  }
  if (row.kind === "SETTLEMENT" && amount.gt(balance.payable)) throw new Error("الدفعة تتجاوز صافي المستحق على العقد");
  if (row.kind === "RETENTION_RELEASE" && amount.gt(balance.retained)) throw new Error("القيمة تتجاوز التأمين المحتجز المتاح");
  if (row.kind === "ADVANCE" && previous.filter(p => p.kind === "ADVANCE").reduce((s, p) => s.add(p.amount), money(0)).add(amount).gt(contract.value)) throw new Error("الدفعات المقدمة تتجاوز قيمة العقد");
  return { amount, retention: money(0), advanceRecovery: money(0), netAmount: amount };
}
async function validateCash(tx: Tx, companyId: string, accountId?: string | null) {
  if (!accountId || !await tx.chartOfAccount.findFirst({ where: { id: accountId, companyId, isActive: true, isHeader: false, type: "ASSET", OR: [{ code: { in: ["1000", "1010"] } }, { bankAccounts: { some: { companyId, isActive: true } } }] }, select: { id: true } })) throw new Error("حساب الصندوق أو البنك غير صالح لهذه الشركة");
}
export async function saveConstruction(companyId: string, userId: string, input: Input) {
  return prisma.$transaction(async tx => {
    // One company lock covers contract limits, duplicate approval and numbering.
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId} FOR UPDATE`;
    const company = await tx.company.findFirst({ where: { id: companyId, type: "CONTRACTING", isActive: true }, select: { id: true } });
    if (!company) throw new Error("هذه العملية متاحة لشركات المقاولات فقط");
    let result: { id: string };
    if (input.action === "project") {
      if (input.endDate && input.endDate < input.startDate) throw new Error("تاريخ النهاية يسبق البداية");
      const id = randomUUID();
      const center = await tx.costCenter.create({ data: { companyId, code: `CT-${input.code}`, nameAr: input.name, type: "CONSTRUCTION_PROJECT" } });
      result = await tx.constructionProject.create({ data: { id, companyId, costCenterId: center.id, code: input.code, name: input.name, clientName: input.clientName, location: input.location, managerName: input.managerName, budget: input.budget, startDate: new Date(input.startDate), endDate: input.endDate ? new Date(input.endDate) : null } });
    } else if (input.action === "approve" || input.action === "void") {
      const row = await tx.constructionDocument.findFirst({ where: { id: input.documentId, project: { companyId } }, include: { project: true, contract: true, journalEntry: true } });
      if (!row) throw new Error("الحركة غير موجودة");
      if (input.action === "void") {
        if (row.status !== "DRAFT") throw new Error("يمكن إلغاء المسودات فقط؛ الحركات المعتمدة تُصحح من القيود المحاسبية");
        result = await tx.constructionDocument.update({ where: { id: row.id }, data: { status: "VOID" } });
      } else {
        if (row.status !== "DRAFT") throw new Error("الحركة سبق اعتمادها أو إلغاؤها");
        if (row.project.status !== "ACTIVE") throw new Error("المشروع غير نشط");
        const amounts = await amountsFor(tx, row.projectId, row);
        if (row.kind !== "CLAIM") await validateCash(tx, companyId, row.cashAccountId);
        const calculated = movementLines({ ...row, ...amounts }, row.contract?.kind === "CUSTOMER");
        const codes = calculated.lines.flatMap(l => l.code ? [l.code] : []);
        const accounts = await tx.chartOfAccount.findMany({ where: { companyId, code: { in: codes }, isActive: true, isHeader: false }, select: { id: true, code: true } });
        const accountIds = new Map(accounts.map(a => [a.code, a.id]));
        const lines = calculated.lines.map((line, sortOrder) => {
          const accountId = line.accountId ?? accountIds.get(line.code!);
          if (!accountId) throw new Error(`الحساب ${line.code} غير متاح في دليل الشركة`);
          return { accountId, debit: line.debit, credit: line.credit, sortOrder, costCenterId: row.project.costCenterId, descriptionAr: row.description };
        });
        let fiscal = await tx.fiscalYear.findFirst({ where: { companyId, startDate: { lte: row.date }, endDate: { gte: row.date } } });
        if (!fiscal) {
          const year = row.date.getUTCFullYear();
          if (await tx.fiscalYear.findUnique({ where: { companyId_year: { companyId, year } } })) throw new Error("تاريخ الحركة خارج الفترة المالية؛ راجع إعداداتها");
          fiscal = await tx.fiscalYear.create({ data: { companyId, year, startDate: new Date(`${year}-01-01`), endDate: new Date(`${year}-12-31T23:59:59.999Z`) } });
        }
        if (fiscal.isLocked) throw new Error("الفترة المالية مغلقة");
        const journalId = randomUUID();
        const sequence = await tx.journalEntry.count({ where: { companyId, refModule: "CONTRACTING" } });
        const journal = await tx.journalEntry.create({ data: { id: journalId, companyId, fiscalYearId: fiscal.id, number: `CT-${fiscal.year}-${String(sequence + 1).padStart(6, "0")}`, date: row.date, descriptionAr: `${row.project.name} - ${row.description}`, type: row.kind === "CLAIM" ? "GENERAL" : row.contract?.kind === "CUSTOMER" ? "RECEIPT" : "PAYMENT", status: "DRAFT", reference: row.reference, refModule: "CONTRACTING", refId: row.id, isAutomatic: true, costCenterId: row.project.costCenterId, totalDebit: calculated.total, totalCredit: calculated.total, createdById: userId, lines: { create: lines } } });
        result = await tx.constructionDocument.update({ where: { id: row.id }, data: { ...amounts, status: "APPROVED", journalEntryId: journal.id } });
      }
    } else {
      const project = await projectFor(tx, companyId, input.projectId);
      if (input.action === "projectStatus") {
        result = await tx.constructionProject.update({ where: { id: project.id }, data: { status: input.status } });
      } else if (input.action === "projectUpdate") {
        result = await tx.constructionProject.update({ where: { id: project.id }, data: { name: input.name, location: input.location, managerName: input.managerName, budget: input.budget } });
        await tx.costCenter.update({ where: { id: project.costCenterId }, data: { nameAr: input.name } });
      } else {
        if (project.status !== "ACTIVE") throw new Error("المشروع غير نشط");
        if (input.action === "contractUpdate") {
          const contract = await tx.constructionContract.findFirst({ where: { id: input.contractId, projectId: project.id } });
          if (!contract) throw new Error("العقد غير موجود في المشروع");
          const approved = await tx.constructionDocument.findMany({ where: { contractId: contract.id, status: "APPROVED", journalEntry: liveJournal } });
          const balance = contractBalances(approved);
          const advances = approved.filter(d => d.kind === "ADVANCE").reduce((s, d) => s.add(d.amount), money(0));
          if (money(input.value).lt(balance.claimed) || money(input.value).lt(advances)) throw new Error("قيمة العقد لا يمكن أن تقل عن المستخلصات أو الدفعات المقدمة المعتمدة");
          result = await tx.constructionContract.update({ where: { id: contract.id }, data: { value: input.value } });
          await tx.auditLog.create({ data: { userId, companyId, action: "CONTRACT_VALUE_CHANGE", module: "contracting", resourceType: "ConstructionContract", resourceId: contract.id, oldValues: { value: contract.value.toFixed(3) }, newValues: { value: input.value, reason: input.reason } } });
        } else if (input.action === "contract") {
          if (input.retentionPercent + input.advanceRecoveryPercent > 100) throw new Error("مجموع نسب الخصم يتجاوز 100% ");
          result = await tx.constructionContract.create({ data: { projectId: project.id, number: input.number, kind: input.kind, partyName: input.partyName, description: input.description, value: input.value, retentionPercent: input.retentionPercent, advanceRecoveryPercent: input.advanceRecoveryPercent } });
        } else if (input.action === "dailyLog") {
          if (input.date < project.startDate.toISOString().slice(0, 10)) throw new Error("التاريخ يسبق بداية المشروع");
          result = await tx.constructionDailyLog.create({ data: { projectId: project.id, date: new Date(input.date), description: input.description, workersCount: input.workersCount, progressPercent: input.progressPercent, createdById: userId } });
        } else {
          const date = new Date(input.date);
          if (date < project.startDate) throw new Error("تاريخ الحركة يسبق بداية المشروع");
          if (input.kind === "COST" && input.contractId) throw new Error("تكلفة المشروع المباشرة لا ترتبط بعقد مقاول باطن؛ استخدم المستخلص");
          if (input.kind !== "CLAIM") await validateCash(tx, companyId, input.cashAccountId);
          if (input.kind === "COST" && !input.category) throw new Error("اختر تصنيف التكلفة");
          const amounts = await amountsFor(tx, project.id, { ...input, date });
          result = await tx.constructionDocument.create({ data: { projectId: project.id, contractId: input.contractId || null, kind: input.kind, date, reference: input.reference, description: input.description, ...amounts, category: input.category, cashAccountId: input.kind === "CLAIM" ? null : input.cashAccountId, createdById: userId } });
        }
      }
    }
    await tx.auditLog.create({ data: { userId, companyId, action: input.action.toUpperCase(), module: "contracting", resourceType: "Construction", resourceId: result.id, newValues: JSON.parse(JSON.stringify(input)) } });
    return result;
  }, { timeout: 30000 });
}
