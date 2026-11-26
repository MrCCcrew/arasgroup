import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { GroceryPurchaseInvoice } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry, getCurrentFiscalYear, postJournalEntry } from "@/lib/accounting/journal-engine";
import { uploadToR2 } from "@/lib/storage/r2";

const retailTypes = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] as const;
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

function inventoryCode(type: string) {
  if (type === "CLOTHING_RETAIL") return "1061";
  if (["FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL"].includes(type)) return "1062";
  if (type === "TAILORING") return "1063";
  if (type === "TOBACCO_SHISHA") return "1066";
  if (type === "MOBILE_REPAIR_ACCESSORIES") return "1067";
  return "1060";
}
function paymentCode(method: string) { return method === "BANK" ? "1010" : "1000"; }

async function access(request: NextRequest, companyId: string, action: "VIEW" | "CREATE") {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY_SUBMISSIONS", action, { companyId }); if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, isActive: true, type: { in: [...retailTypes] } }, select: { id: true, type: true } });
  return company ? { session, company } : NextResponse.json({ success: false, error: "Retail operations are not enabled for this company" }, { status: 404 });
}

async function post(companyId: string, userId: string, date: Date, refId: string, lines: { accountId: string; debit: number; credit: number }[], descriptionEn: string) {
  const entry = await createJournalEntry({ companyId, fiscalYearId: await getCurrentFiscalYear(companyId), date, descriptionAr: descriptionEn, descriptionEn, type: "GENERAL", refModule: "grocery-payable", refId, isAutomatic: true, lines, createdById: userId });
  return postJournalEntry(entry.id, userId);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const current = await access(request, companyId, "VIEW"); if (current instanceof NextResponse) return current;
  const invoices = await prisma.groceryPurchaseInvoice.findMany({
    where: { companyId, paymentMethod: "CREDIT" },
    include: { settlements: { orderBy: { date: "desc" } } }, orderBy: [{ outstandingAmount: "desc" }, { date: "desc" }],
  });
  return NextResponse.json({ success: true, data: invoices.map((invoice) => ({ ...invoice, amount: Number(invoice.amount), outstandingAmount: Number(invoice.outstandingAmount), settlements: invoice.settlements.map((item) => ({ ...item, amount: Number(item.amount) })) })) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const current = await access(request, companyId, "CREATE"); if (current instanceof NextResponse) return current;
  let requestAction = "";
  let retryInvoiceNumber = "";
  try {
    const form = await request.formData(); const action = String(form.get("action") ?? ""); requestAction = action; const file = form.get("file");
    if (!(file instanceof File) || !extensions[file.type] || file.size > 10 * 1024 * 1024) return NextResponse.json({ success: false, error: "Attach a PDF or image up to 10 MB" }, { status: 400 });
    const fileUrl = await uploadToR2(`grocery/${companyId}/payables-${nanoid(12)}.${extensions[file.type]}`, Buffer.from(await file.arrayBuffer()), file.type);
    if (action === "INVOICE") {
      const invoiceNumber = String(form.get("invoiceNumber") ?? "").trim(); retryInvoiceNumber = invoiceNumber; const supplierName = String(form.get("supplierName") ?? "").trim(); const dateText = String(form.get("date") ?? ""); const amount = Number(form.get("amount") ?? 0); const isOpening = String(form.get("isOpeningInventoryInvoice")) === "true";
      const notes = String(form.get("notes") ?? "").trim() || null;
      if (!invoiceNumber || !supplierName || !dateText || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ success: false, error: "Enter a valid supplier, invoice, date and amount" }, { status: 400 });
      // Invoice numbers are intentionally unique within a company.  Mobile
      // connections may retry a successful upload, so a retry must not look
      // like a failed save (or create a second payable/accounting entry).
      const existing = await prisma.groceryPurchaseInvoice.findUnique({ where: { companyId_invoiceNumber: { companyId, invoiceNumber } } });
      if (existing) return NextResponse.json({ success: true, alreadyExists: true, data: existing });
      let invoice: GroceryPurchaseInvoice;
      try {
        invoice = await prisma.groceryPurchaseInvoice.create({ data: { companyId, invoiceNumber, supplierName, date: new Date(dateText), amount, outstandingAmount: amount, isOpeningInventoryInvoice: isOpening, paymentMethod: "CREDIT", fileUrl, notes, createdById: current.session.id } });
      } catch (error) {
        // Covers two requests reaching this point at the same time.
        if ((error as { code?: string }).code === "P2002") {
          const duplicate = await prisma.groceryPurchaseInvoice.findUnique({ where: { companyId_invoiceNumber: { companyId, invoiceNumber } } });
          if (duplicate) return NextResponse.json({ success: true, alreadyExists: true, data: duplicate });
        }
        throw error;
      }
      try {
        const codes = isOpening ? ["3030", "2030"] : [inventoryCode(current.company.type), "2030"];
        const accounts = await prisma.chartOfAccount.findMany({ where: { companyId, code: { in: codes } }, select: { id: true, code: true } }); const byCode = new Map(accounts.map((a) => [a.code, a.id]));
        if (codes.some((code) => !byCode.get(code))) throw new Error("Required chart account is missing");
        await post(companyId, current.session.id, invoice.date, invoice.id, [{ accountId: byCode.get(codes[0])!, debit: amount, credit: 0 }, { accountId: byCode.get("2030")!, debit: 0, credit: amount }], isOpening ? "Historical supplier invoice included in opening inventory" : "Credit inventory purchase");
      } catch (error) { await prisma.groceryPurchaseInvoice.delete({ where: { id: invoice.id } }); throw error; }
      return NextResponse.json({ success: true, data: invoice }, { status: 201 });
    }
    if (action === "SETTLEMENT") {
      const invoiceId = String(form.get("invoiceId") ?? ""); const dateText = String(form.get("date") ?? ""); const amount = Number(form.get("amount") ?? 0); const paymentMethod = String(form.get("paymentMethod") ?? "CASH"); const notes = String(form.get("notes") ?? "").trim() || null;
      if (!invoiceId || !dateText || !Number.isFinite(amount) || amount <= 0 || !["CASH", "BANK"].includes(paymentMethod)) return NextResponse.json({ success: false, error: "Enter a valid settlement" }, { status: 400 });
      const settlement = await prisma.$transaction(async (tx) => {
        const invoice = await tx.groceryPurchaseInvoice.findFirst({ where: { id: invoiceId, companyId, paymentMethod: "CREDIT" } });
        if (!invoice) throw new Error("Credit invoice was not found");
        if (amount > Number(invoice.outstandingAmount)) throw new Error("Settlement exceeds the outstanding amount");
        await tx.groceryPurchaseInvoice.update({ where: { id: invoiceId }, data: { outstandingAmount: { decrement: amount } } });
        return tx.groceryPurchaseSettlement.create({ data: { companyId, purchaseInvoiceId: invoiceId, date: new Date(dateText), amount, paymentMethod, fileUrl, notes, createdById: current.session.id } });
      });
      try {
        const accounts = await prisma.chartOfAccount.findMany({ where: { companyId, code: { in: ["2030", paymentCode(paymentMethod)] } }, select: { id: true, code: true } }); const byCode = new Map(accounts.map((a) => [a.code, a.id]));
        if (!byCode.get("2030") || !byCode.get(paymentCode(paymentMethod))) throw new Error("Required chart account is missing");
        await post(companyId, current.session.id, settlement.date, settlement.id, [{ accountId: byCode.get("2030")!, debit: amount, credit: 0 }, { accountId: byCode.get(paymentCode(paymentMethod))!, debit: 0, credit: amount }], "Supplier invoice settlement");
      } catch (error) { await prisma.$transaction([prisma.groceryPurchaseSettlement.delete({ where: { id: settlement.id } }), prisma.groceryPurchaseInvoice.update({ where: { id: invoiceId }, data: { outstandingAmount: { increment: amount } } })]); throw error; }
      return NextResponse.json({ success: true, data: settlement }, { status: 201 });
    }
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    // A network retry can reach the database after the first request committed.
    // Never expose Prisma's unique-key error for an invoice that already exists.
    if (requestAction === "INVOICE" && (error as { code?: string }).code === "P2002") {
      if (retryInvoiceNumber) {
        const duplicate = await prisma.groceryPurchaseInvoice.findUnique({ where: { companyId_invoiceNumber: { companyId, invoiceNumber: retryInvoiceNumber } } });
        if (duplicate) return NextResponse.json({ success: true, alreadyExists: true, data: duplicate });
      }
    }
    return NextResponse.json({ success: false, error: "Unable to save payable" }, { status: 500 });
  }
}
