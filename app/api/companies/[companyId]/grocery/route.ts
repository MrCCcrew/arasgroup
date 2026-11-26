import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { createJournalEntry, getCurrentFiscalYear, postJournalEntry } from "@/lib/accounting/journal-engine";
import { initializeCompanyChart } from "@/lib/accounting/company-chart";

const retailTypes = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] as const;

async function access(request: NextRequest, companyId: string, action: "VIEW" | "CREATE") {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const companyError = assertCompanyAccess(session, companyId);
  if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY", action, { companyId });
  if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: { in: [...retailTypes] }, isActive: true }, select: { id: true } });
  return company ? session : NextResponse.json({ success: false, error: "Grocery operations are not enabled for this company" }, { status: 404 });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId, "VIEW");
  if (session instanceof NextResponse) return session;
  const [company, openingInventory, purchases, expenses, products, sales, deposits, devices, statements] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { retailAverageGrossMargin: true, retailAverageMarginAsOf: true } }),
    prisma.groceryOpeningInventory.findUnique({ where: { companyId } }),
    prisma.groceryPurchaseInvoice.findMany({ where: { companyId }, orderBy: { date: "desc" }, take: 100 }),
    prisma.groceryOperatingExpense.findMany({ where: { companyId }, orderBy: { date: "desc" }, take: 100 }),
    prisma.groceryProduct.findMany({ where: { companyId }, orderBy: { nameAr: "asc" } }),
    prisma.grocerySaleInvoice.findMany({ where: { companyId }, orderBy: { date: "desc" }, take: 50 }),
    prisma.groceryDepositReceipt.findMany({ where: { companyId }, orderBy: { date: "desc" }, take: 50 }),
    prisma.groceryKnetDevice.findMany({ where: { companyId }, orderBy: { number: "asc" } }),
    prisma.groceryBankStatement.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const opening = Number(openingInventory?.amount ?? 0);
  // Old credit supplier invoices represent payables that already belong to
  // opening inventory. They must not add to stock for a second time.
  const purchaseValue = purchases
    .filter((row) => !row.isOpeningInventoryInvoice)
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const openingCreditPayables = purchases
    .filter((row) => row.isOpeningInventoryInvoice)
    .reduce((sum, row) => sum + Number(row.outstandingAmount), 0);
  const salesValue = sales.reduce((sum, row) => sum + Number(row.amount), 0);
  // Sales are entered as totals, not item costs. A configured gross margin is
  // an estimate from the most recent stock count only; it never posts a COGS
  // journal entry. The final cost remains determined by periodic inventory.
  const averageGrossMarginPercent = company.retailAverageGrossMargin === null ? null : Number(company.retailAverageGrossMargin);
  const estimatedCostOfSales = averageGrossMarginPercent === null ? null : salesValue * (1 - averageGrossMarginPercent / 100);
  const costOfSales = estimatedCostOfSales;
  const expenseValue = expenses.reduce((sum, row) => sum + Number(row.amount), 0);
  return NextResponse.json({ success: true, data: { openingInventory, purchases, expenses, products, sales, deposits, devices, statements, summary: { opening, purchaseValue, openingCreditPayables, salesValue, costOfSales, estimatedCostOfSales, averageGrossMarginPercent, averageMarginAsOf: company.retailAverageMarginAsOf, expenseValue, inventoryValue: opening + purchaseValue } } });
}

const productSchema = z.object({ action: z.literal("PRODUCT"), sku: z.string().trim().min(1), nameAr: z.string().trim().min(1), unit: z.string().trim().min(1).default("قطعة"), quantity: z.coerce.number().min(0), costPrice: z.coerce.number().min(0), salePrice: z.coerce.number().min(0) });
const deviceSchema = z.object({ action: z.literal("KNET_DEVICE"), number: z.string().trim().min(1), label: z.string().trim().max(120).optional() });
const openingSchema = z.object({ action: z.literal("OPENING_INVENTORY"), date: z.coerce.date(), amount: z.coerce.number().positive(), notes: z.string().trim().max(500).optional() });
const marginSchema = z.object({ action: z.literal("AVERAGE_GROSS_MARGIN"), grossMarginPercent: z.coerce.number().min(0).max(99.99), asOf: z.coerce.date() });

function inventoryAccountCode(type: string) {
  if (type === "CLOTHING_RETAIL") return "1061";
  if (["FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL"].includes(type)) return "1062";
  if (type === "TAILORING") return "1063";
  if (type === "TOBACCO_SHISHA") return "1066";
  if (type === "MOBILE_REPAIR_ACCESSORIES") return "1067";
  return "1060";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params; const session = await access(request, companyId, "CREATE");
  if (session instanceof NextResponse) return session;
  const input = await request.json().catch(() => null);
  const parsed = input?.action === "PRODUCT" ? productSchema.safeParse(input) : input?.action === "OPENING_INVENTORY" ? openingSchema.safeParse(input) : input?.action === "AVERAGE_GROSS_MARGIN" ? marginSchema.safeParse(input) : deviceSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Please review the entered information" }, { status: 400 });
  if (input?.action === "AVERAGE_GROSS_MARGIN") {
    const data = marginSchema.parse(input);
    const saved = await prisma.company.update({ where: { id: companyId }, data: { retailAverageGrossMargin: data.grossMarginPercent, retailAverageMarginAsOf: data.asOf }, select: { retailAverageGrossMargin: true, retailAverageMarginAsOf: true } });
    return NextResponse.json({ success: true, data: saved });
  }
  if (input?.action === "OPENING_INVENTORY") {
    const data = openingSchema.parse(input);
    try {
      // Older retail companies can predate their activity-specific chart accounts.
      // Always complete the chart before accepting an opening balance.
      const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { type: true } });
      await prisma.$transaction((tx) => initializeCompanyChart(tx, companyId, company.type));

      const inventoryCode = inventoryAccountCode(company.type);
      const accounts = await prisma.chartOfAccount.findMany({
        where: { companyId, code: { in: [inventoryCode, "3030"] } },
        select: { id: true, code: true },
      });
      const byCode = new Map(accounts.map((account) => [account.code, account.id]));
      if (!byCode.get(inventoryCode) || !byCode.get("3030")) throw new Error("Required opening accounts are missing");

      // A previous failed attempt may have saved the opening row before the journal
      // entry was created. Reuse it and complete the missing journal instead of
      // forcing the user to enter the balance again or creating a duplicate.
      const existing = await prisma.groceryOpeningInventory.findUnique({ where: { companyId } });
      const opening = existing ?? await prisma.groceryOpeningInventory.create({
        data: { companyId, date: data.date, amount: data.amount, notes: data.notes || null, createdById: session.id },
      });
      const postedEntry = await prisma.journalEntry.findFirst({
        where: { companyId, refModule: "grocery", refId: opening.id, isDeleted: false },
        select: { id: true, status: true },
      });
      if (postedEntry) {
        if (postedEntry.status !== "POSTED") await postJournalEntry(postedEntry.id, session.id);
        return NextResponse.json({ success: true, data: opening });
      }

      const entry = await createJournalEntry({ companyId, fiscalYearId: await getCurrentFiscalYear(companyId), date: data.date, descriptionAr: "Opening inventory balance", type: "GENERAL", refModule: "grocery", refId: opening.id, isAutomatic: true, lines: [{ accountId: byCode.get(inventoryCode)!, debit: data.amount, credit: 0 }, { accountId: byCode.get("3030")!, debit: 0, credit: data.amount }], createdById: session.id });
      await postJournalEntry(entry.id, session.id);
      return NextResponse.json({ success: true, data: opening }, { status: 201 });
    } catch (error) { return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to save opening inventory" }, { status: 500 }); }
  }
  try {
    const data = input?.action === "PRODUCT" ? productSchema.parse(input) : input?.action === "OPENING_INVENTORY" ? openingSchema.parse(input) : deviceSchema.parse(input);
    const saved = data.action === "PRODUCT"
      ? await prisma.groceryProduct.upsert({ where: { companyId_sku: { companyId, sku: data.sku } }, update: { nameAr: data.nameAr, unit: data.unit, quantity: data.quantity, costPrice: data.costPrice, salePrice: data.salePrice }, create: { companyId, sku: data.sku, nameAr: data.nameAr, unit: data.unit, quantity: data.quantity, costPrice: data.costPrice, salePrice: data.salePrice } })
      : data.action === "OPENING_INVENTORY"
        ? await prisma.groceryOpeningInventory.upsert({ where: { companyId }, update: { date: data.date, amount: data.amount, notes: data.notes || null, createdById: session.id }, create: { companyId, date: data.date, amount: data.amount, notes: data.notes || null, createdById: session.id } })
      : await prisma.groceryKnetDevice.create({ data: { companyId, number: data.number, label: data.label || null } });
    return NextResponse.json({ success: true, data: saved }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") return NextResponse.json({ success: false, error: "The number or item code already exists" }, { status: 409 });
    return NextResponse.json({ success: false, error: "Unable to save" }, { status: 500 });
  }
}
