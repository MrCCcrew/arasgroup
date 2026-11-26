import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getRetailTransactions } from "@/lib/grocery/transactions";
import { uploadToR2 } from "@/lib/storage/r2";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry, getCurrentFiscalYear, postJournalEntry, reverseJournalEntry } from "@/lib/accounting/journal-engine";

type Kind = "PURCHASE" | "EXPENSE" | "SALE" | "DEPOSIT" | "STATEMENT";
const KINDS: Kind[] = ["PURCHASE", "EXPENSE", "SALE", "DEPOSIT", "STATEMENT"];
const RETAIL_TYPES = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] as const;
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

function codesFor(type: string) {
  if (type === "CLOTHING_RETAIL") return { inventory: "1061", revenue: "4053" };
  if (type === "FABRIC_RETAIL" || type === "TAILORING_FABRIC_RETAIL") return { inventory: "1062", revenue: "4054" };
  if (type === "TAILORING") return { inventory: "1063", revenue: "4055" };
  if (type === "TOBACCO_SHISHA") return { inventory: "1066", revenue: "4056" };
  if (type === "MOBILE_REPAIR_ACCESSORIES") return { inventory: "1067", revenue: "4057" };
  return { inventory: "1060", revenue: "4050" };
}
function paymentAccount(method: string, kind: Exclude<Kind, "STATEMENT">) {
  // A credit purchase creates a supplier payable, while a credit sale creates
  // a customer receivable. They must never use the same account.
  if (method === "CREDIT") return kind === "SALE" ? "1070" : "2030";
  return method === "BANK" ? "1010" : method === "KNET" ? "1020" : "1000";
}
async function postRetailEntry(p: { companyId: string; userId: string; date: Date; kind: Exclude<Kind, "STATEMENT">; amount: number; paymentMethod: string; refId: string }) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: p.companyId }, select: { type: true } });
  const codes = codesFor(company.type); const payment = paymentAccount(p.paymentMethod, p.kind);
  const accounts = await prisma.chartOfAccount.findMany({ where: { companyId: p.companyId, code: { in: [...new Set([codes.inventory, codes.revenue, payment, "5099", "1010", "1000"])] } }, select: { id: true, code: true } });
  const map = new Map(accounts.map((a) => [a.code, a.id]));
  const account = (code: string) => { const id = map.get(code); if (!id) throw new Error(`Required chart account ${code} is missing`); return id; };
  const lines = p.kind === "PURCHASE" ? [{ accountId: account(codes.inventory), debit: p.amount, credit: 0 }, { accountId: account(payment), debit: 0, credit: p.amount }]
    : p.kind === "EXPENSE" ? [{ accountId: account("5099"), debit: p.amount, credit: 0 }, { accountId: account(payment), debit: 0, credit: p.amount }]
    : p.kind === "DEPOSIT" ? [{ accountId: account("1010"), debit: p.amount, credit: 0 }, { accountId: account("1000"), debit: 0, credit: p.amount }]
    : [{ accountId: account(payment), debit: p.amount, credit: 0 }, { accountId: account(codes.revenue), debit: 0, credit: p.amount }];
  const entry = await createJournalEntry({ companyId: p.companyId, fiscalYearId: await getCurrentFiscalYear(p.companyId), date: p.date, descriptionAr: `Retail ${p.kind}`, type: "GENERAL", refModule: "grocery", refId: p.refId, isAutomatic: true, lines, createdById: p.userId });
  return postJournalEntry(entry.id, p.userId);
}

async function access(request: NextRequest, companyId: string, action: "VIEW" | "CREATE" | "UPDATE") {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY_SUBMISSIONS", action, { companyId }); if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: { in: [...RETAIL_TYPES] }, isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "Retail operations are not enabled for this company" }, { status: 404 });
}
async function managerAccess(request: NextRequest, companyId: string) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY", "UPDATE", { companyId }); if (permissionError) return permissionError;
  return session;
}
async function recordFor(kind: Kind, id: string) {
  if (kind === "PURCHASE") return prisma.groceryPurchaseInvoice.findUnique({ where: { id } });
  if (kind === "EXPENSE") return prisma.groceryOperatingExpense.findUnique({ where: { id } });
  if (kind === "SALE") return prisma.grocerySaleInvoice.findUnique({ where: { id } });
  if (kind === "DEPOSIT") return prisma.groceryDepositReceipt.findUnique({ where: { id } });
  return prisma.groceryBankStatement.findUnique({ where: { id } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId, "VIEW"); if (session instanceof NextResponse) return session;
  return NextResponse.json({ success: true, data: { transactions: await getRetailTransactions(companyId) } });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId, "CREATE"); if (session instanceof NextResponse) return session;
  let attemptedPurchaseReference = "";
  try {
    const form = await request.formData(); const file = form.get("file"); const kind = String(form.get("kind") ?? "") as Kind;
    let dateText = String(form.get("date") ?? ""); const amount = Number(form.get("amount") ?? 0); let reference = String(form.get("reference") ?? "").trim();
    const fromDateText = String(form.get("fromDate") ?? ""); const toDateText = String(form.get("toDate") ?? "");
    const paymentMethod = String(form.get("paymentMethod") ?? "CASH"); const notes = String(form.get("notes") ?? "").trim() || null;
    if (!KINDS.includes(kind)) return NextResponse.json({ success: false, error: "Select the document type" }, { status: 400 });
    if (!(file instanceof File) || !EXTENSIONS[file.type] || file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: "Attach a PDF or image up to 10 MB" }, { status: 400 });
    const employeeAutoEntry = String(session.accountType) === "GROCERY_EMPLOYEE" && (kind === "SALE" || kind === "EXPENSE");
    if (employeeAutoEntry) {
      if (!dateText) dateText = new Date().toISOString().slice(0, 10);
      if (!reference) reference = `${kind}-${dateText.replaceAll("-", "")}-${nanoid(8)}`;
    }
    if (kind === "PURCHASE") attemptedPurchaseReference = reference;
    if (kind !== "STATEMENT" && (!dateText || !reference || !Number.isFinite(amount) || amount <= 0)) return NextResponse.json({ success: false, error: "Enter a valid date, reference and amount" }, { status: 400 });
    if (kind === "STATEMENT" && ((!fromDateText && toDateText) || (fromDateText && !toDateText) || (fromDateText && toDateText && new Date(fromDateText) > new Date(toDateText)))) return NextResponse.json({ success: false, error: "Enter a valid statement period" }, { status: 400 });
    if (!["CASH", "KNET", "BANK", "CREDIT"].includes(paymentMethod)) return NextResponse.json({ success: false, error: "Invalid payment method" }, { status: 400 });
    if ((kind === "EXPENSE" || kind === "DEPOSIT") && paymentMethod === "CREDIT") return NextResponse.json({ success: false, error: "Credit is only available for purchases and sales" }, { status: 400 });
    if (kind === "PURCHASE") {
      const existing = await prisma.groceryPurchaseInvoice.findUnique({ where: { companyId_invoiceNumber: { companyId, invoiceNumber: reference } } });
      if (existing) return NextResponse.json({ success: true, alreadyExists: true, data: existing });
    }
    const fileUrl = await uploadToR2(`grocery/${companyId}/${kind.toLowerCase()}-${nanoid(12)}.${EXTENSIONS[file.type]}`, Buffer.from(await file.arrayBuffer()), file.type);
    const record = kind === "PURCHASE" ? await prisma.groceryPurchaseInvoice.create({ data: { companyId, invoiceNumber: reference, date: new Date(dateText), amount, paymentMethod, fileUrl, notes, createdById: session.id } })
      : kind === "EXPENSE" ? await prisma.groceryOperatingExpense.create({ data: { companyId, reference, date: new Date(dateText), amount, paymentMethod, fileUrl, notes, createdById: session.id } })
      : kind === "SALE" ? await prisma.grocerySaleInvoice.create({ data: { companyId, invoiceNumber: reference, date: new Date(dateText), amount, paymentMethod, inventoryCost: 0, fileUrl, notes, createdById: session.id } })
      : kind === "DEPOSIT" ? await prisma.groceryDepositReceipt.create({ data: { companyId, date: new Date(dateText), amount, paymentMethod, fileUrl, notes: reference, createdById: session.id } })
      : await prisma.groceryBankStatement.create({ data: { companyId, fromDate: fromDateText ? new Date(fromDateText) : null, toDate: toDateText ? new Date(toDateText) : null, fileUrl, createdById: session.id } });
    try { if (kind !== "STATEMENT") await postRetailEntry({ companyId, userId: session.id, date: new Date(dateText), kind, amount, paymentMethod, refId: record.id }); }
    catch (error) {
      if (kind === "PURCHASE") await prisma.groceryPurchaseInvoice.delete({ where: { id: record.id } });
      else if (kind === "EXPENSE") await prisma.groceryOperatingExpense.delete({ where: { id: record.id } });
      else if (kind === "SALE") await prisma.grocerySaleInvoice.delete({ where: { id: record.id } });
      else if (kind === "DEPOSIT") await prisma.groceryDepositReceipt.delete({ where: { id: record.id } });
      else await prisma.groceryBankStatement.delete({ where: { id: record.id } });
      throw error;
    }
    await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "UPLOAD_GROCERY_DOCUMENT", module: "grocery", resourceId: record.id, resourceType: kind, newValues: { reference, amount, paymentMethod, fileName: file.name } } });
    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error) {
    if (attemptedPurchaseReference && (error as { code?: string }).code === "P2002") {
      const duplicate = await prisma.groceryPurchaseInvoice.findUnique({ where: { companyId_invoiceNumber: { companyId, invoiceNumber: attemptedPurchaseReference } } });
      if (duplicate) return NextResponse.json({ success: true, alreadyExists: true, data: duplicate });
    }
    return NextResponse.json({ success: false, error: "Unable to upload the document" }, { status: 500 });
  }
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await managerAccess(request, companyId); if (session instanceof NextResponse) return session;
  const body = await request.json().catch(() => null); const kind = String(body?.kind ?? "") as Kind; const id = String(body?.id ?? "");
  if (!KINDS.includes(kind) || !id) return NextResponse.json({ success: false, error: "Invalid record" }, { status: 400 });
  const record = await recordFor(kind, id); if (!record || record.companyId !== companyId) return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
  const journal = await prisma.journalEntry.findFirst({ where: { companyId, refModule: "grocery", refId: id, status: "POSTED", isDeleted: false, isReversed: false }, select: { id: true } });
  if (journal) await reverseJournalEntry(journal.id, session.id);
  if (kind === "PURCHASE") await prisma.groceryPurchaseInvoice.delete({ where: { id } }); else if (kind === "EXPENSE") await prisma.groceryOperatingExpense.delete({ where: { id } }); else if (kind === "SALE") await prisma.grocerySaleInvoice.delete({ where: { id } }); else if (kind === "DEPOSIT") await prisma.groceryDepositReceipt.delete({ where: { id } }); else await prisma.groceryBankStatement.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "DELETE_GROCERY_DOCUMENT", module: "grocery", resourceId: id, resourceType: kind } });
  return NextResponse.json({ success: true });
}

const updateSchema = z.object({
  id: z.string().min(1), kind: z.enum(["PURCHASE", "EXPENSE", "SALE", "DEPOSIT"]), date: z.coerce.date(),
  reference: z.string().trim().min(1).max(191), amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["CASH", "KNET", "BANK", "CREDIT"]), notes: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await managerAccess(request, companyId); if (session instanceof NextResponse) return session;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "Review the record details" }, { status: 400 });
  const data = parsed.data;
  if ((data.kind === "EXPENSE" || data.kind === "DEPOSIT") && data.paymentMethod === "CREDIT") return NextResponse.json({ success: false, error: "Credit is only available for purchases and sales" }, { status: 400 });
  const record = await recordFor(data.kind, data.id); if (!record || record.companyId !== companyId) return NextResponse.json({ success: false, error: "Record not found" }, { status: 404 });
  const financialRecord = record as { date: Date; amount?: unknown; paymentMethod?: string };
  const prior = { date: financialRecord.date, amount: Number(financialRecord.amount ?? 0), paymentMethod: financialRecord.paymentMethod ?? (data.kind === "DEPOSIT" ? "BANK" : "CASH") };
  try {
    const journal = await prisma.journalEntry.findFirst({ where: { companyId, refModule: "grocery", refId: data.id, status: "POSTED", isDeleted: false, isReversed: false }, select: { id: true } });
    if (journal) await reverseJournalEntry(journal.id, session.id);
    let updated;
    if (data.kind === "PURCHASE") updated = await prisma.groceryPurchaseInvoice.update({ where: { id: data.id }, data: { invoiceNumber: data.reference, date: data.date, amount: data.amount, paymentMethod: data.paymentMethod, notes: data.notes || null } });
  else if (data.kind === "EXPENSE") updated = await prisma.groceryOperatingExpense.update({ where: { id: data.id }, data: { reference: data.reference, date: data.date, amount: data.amount, paymentMethod: data.paymentMethod, notes: data.notes || null } });
    else if (data.kind === "SALE") updated = await prisma.grocerySaleInvoice.update({ where: { id: data.id }, data: { invoiceNumber: data.reference, date: data.date, amount: data.amount, paymentMethod: data.paymentMethod, notes: data.notes || null } });
  else updated = await prisma.groceryDepositReceipt.update({ where: { id: data.id }, data: { date: data.date, amount: data.amount, paymentMethod: data.paymentMethod, notes: data.reference } });
    await postRetailEntry({ companyId, userId: session.id, date: data.date, kind: data.kind, amount: data.amount, paymentMethod: data.paymentMethod, refId: data.id });
    await prisma.auditLog.create({ data: { userId: session.id, companyId, action: "UPDATE_GROCERY_DOCUMENT", module: "grocery", resourceId: data.id, resourceType: data.kind, oldValues: prior, newValues: data } });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to update record" }, { status: 500 }); }
}
