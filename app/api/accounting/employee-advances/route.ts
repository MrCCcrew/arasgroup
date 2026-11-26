import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { getAccessibleBranchIds } from "@/lib/auth/permissions";
import { advanceAccount, advanceJournal, advanceSchema, lockAdvanceCompany } from "@/lib/hr/employee-advances";
import { discardLinkedJournalEntry } from "@/lib/accounting/journal-engine";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyId = request.nextUrl.searchParams.get("companyId") || "";
  const access = assertCompanyAccess(session, companyId) || assertPermission(session, "ACCOUNTING", "VIEW", { companyId });
  if (access) return access;
  const branches = getAccessibleBranchIds(session, companyId);
  const branchWhere = branches.length ? { branchId: { in: branches } } : {};
  const [advances, employees, accounts] = await Promise.all([
    prisma.employeeAdvance.findMany({ where: { companyId, employee: branchWhere }, include: {
      employee: { select: { nameAr: true, nameEn: true, employeeNumber: true } },
      installments: { orderBy: [{ year: "asc" }, { month: "asc" }], include: { batch: { select: { id: true, status: true } } } },
    }, orderBy: { createdAt: "desc" } }),
    prisma.employee.findMany({ where: { companyId, isActive: true, isDeleted: false, ...branchWhere }, select: { id: true, nameAr: true, nameEn: true, employeeNumber: true }, orderBy: { nameAr: "asc" } }),
    prisma.chartOfAccount.findMany({ where: { companyId, isActive: true, isHeader: false, type: "ASSET", OR: [{ code: { in: ["1000", "1010"] } }, { bankAccounts: { some: { companyId, isActive: true } } }] }, select: { id: true, nameAr: true, code: true } }),
  ]);
  return NextResponse.json({ success: true, data: { advances, employees, accounts } });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json();
    const companyId = String(body.companyId || "");
    const access = assertCompanyAccess(session, companyId) || assertPermission(session, "ACCOUNTING", "CREATE", { companyId });
    if (access) return access;
    const parsed = advanceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    const data = parsed.data;
    const branches = getAccessibleBranchIds(session, companyId);
    const result = await prisma.$transaction(async tx => {
      await lockAdvanceCompany(tx, companyId);
      const employee = await tx.employee.findFirst({ where: { id: data.employeeId, companyId, isActive: true, isDeleted: false, ...(branches.length ? { branchId: { in: branches } } : {}) } });
      if (!employee) throw new Error("الموظف غير متاح في هذه الشركة أو خارج صلاحياتك");
      const cash = await tx.chartOfAccount.findFirst({ where: { id: data.cashAccountId, companyId, isActive: true, isHeader: false, type: "ASSET", OR: [{ code: { in: ["1000", "1010"] } }, { bankAccounts: { some: { companyId, isActive: true } } }] } });
      if (!cash) throw new Error("اختر صندوقاً أو حساباً بنكياً صالحاً للشركة");
      for (const installment of data.installments) {
        const batch = await tx.salaryBatch.findFirst({ where: { companyId, year: installment.year, month: installment.month, status: { not: "CANCELLED" }, payments: { some: { employeeId: data.employeeId } } } });
        if (batch) throw new Error(`توجد دفعة رواتب للموظف في ${installment.month}/${installment.year}؛ احذف الدفعة غير المصروفة وأعد إنشاؤها بعد تسجيل السلفة، أو اختر شهراً آخر`);
      }
      const accountId = await advanceAccount(tx, companyId);
      const advance = await tx.employeeAdvance.create({ data: { companyId, employeeId: data.employeeId, amount: data.amount, date: new Date(data.date), notes: data.notes, installments: { create: data.installments } } });
      const journal = await advanceJournal(tx, { companyId, userId: session.id, date: new Date(data.date), description: `سلفة موظف - ${employee.nameAr}`, refId: advance.id, lines: [
        { accountId, debit: data.amount, credit: 0, employeeId: data.employeeId },
        { accountId: cash.id, debit: 0, credit: data.amount, employeeId: data.employeeId },
      ] });
      await tx.employeeAdvance.update({ where: { id: advance.id }, data: { journalEntryId: journal.id } });
      await tx.auditLog.create({ data: { userId: session.id, companyId, action: "CREATE", module: "employee_advances", resourceId: advance.id, resourceType: "EmployeeAdvance", newValues: { amount: data.amount, installments: data.installments } } });
      return { ...advance, journalEntryId: journal.id };
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "تعذر تسجيل السلفة" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await request.json();
    const advance = await prisma.employeeAdvance.findUnique({ where: { id }, include: { employee: true } });
    if (!advance) return NextResponse.json({ success: false, error: "السلفة غير موجودة" }, { status: 404 });
    const access = assertCompanyAccess(session, advance.companyId) || assertPermission(session, "ACCOUNTING", "DELETE", { companyId: advance.companyId, branchId: advance.employee.branchId || undefined });
    if (access) return access;
    const branches = getAccessibleBranchIds(session, advance.companyId);
    if (branches.length && (!advance.employee.branchId || !branches.includes(advance.employee.branchId))) return NextResponse.json({ success: false, error: "الموظف خارج نطاق فروعك" }, { status: 403 });
    await prisma.$transaction(async tx => {
      await lockAdvanceCompany(tx, advance.companyId);
      if (await tx.employeeAdvanceInstallment.count({ where: { advanceId: id, batchId: { not: null } } })) throw new Error("لا يمكن إلغاء سلفة مرتبطة بدفعة رواتب؛ ألغِ الدفعة غير المصروفة أولاً");
      await discardLinkedJournalEntry(tx, advance.journalEntryId, { userId: session.id, reasonAr: "إلغاء سلفة موظف" });
      await tx.employeeAdvance.update({ where: { id }, data: { isCancelled: true } });
      await tx.auditLog.create({ data: { userId: session.id, companyId: advance.companyId, action: "CANCEL", module: "employee_advances", resourceId: id, resourceType: "EmployeeAdvance" } });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "تعذر إلغاء السلفة" }, { status: 400 });
  }
}
