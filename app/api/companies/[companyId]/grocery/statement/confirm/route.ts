import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession, assertCompanyAccess, assertPermission } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { takePreview } from "@/lib/owner-management/preview-store";
import { uploadToR2 } from "@/lib/storage/r2";
import { createJournalEntry, getCurrentFiscalYear, postJournalEntry } from "@/lib/accounting/journal-engine";

const retailTypes = ["GROCERY", "CLOTHING_RETAIL", "FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL", "TAILORING", "TOBACCO_SHISHA", "MOBILE_REPAIR_ACCESSORIES"] as const;
export const runtime = "nodejs";
async function postKnetRevenue(companyId: string, userId: string, refId: string, date: Date, amount: number) {
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId }, select: { type: true } });
  const revenue = company.type === "CLOTHING_RETAIL" ? "4053" : ["FABRIC_RETAIL", "TAILORING_FABRIC_RETAIL"].includes(company.type) ? "4054" : company.type === "TAILORING" ? "4055" : company.type === "TOBACCO_SHISHA" ? "4056" : company.type === "MOBILE_REPAIR_ACCESSORIES" ? "4057" : "4050";
  const accounts = await prisma.chartOfAccount.findMany({ where: { companyId, code: { in: ["1020", revenue] } }, select: { id: true, code: true } });
  const ids = new Map(accounts.map((a) => [a.code, a.id]));
  if (!ids.get("1020") || !ids.get(revenue)) throw new Error("Required KNET or revenue account is missing");
  const entry = await createJournalEntry({ companyId, fiscalYearId: await getCurrentFiscalYear(companyId), date, descriptionAr: "KNET statement revenue", type: "GENERAL", refModule: "grocery", refId, isAutomatic: true, createdById: userId, lines: [{ accountId: ids.get("1020")!, debit: amount, credit: 0 }, { accountId: ids.get(revenue)!, debit: 0, credit: amount }] });
  await postJournalEntry(entry.id, userId);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request); if (session instanceof NextResponse) return session;
  const { companyId } = await params;
  const companyError = assertCompanyAccess(session, companyId); if (companyError) return companyError;
  const permissionError = assertPermission(session, "GROCERY", "UPDATE", { companyId }); if (permissionError) return permissionError;
  const company = await prisma.company.findFirst({ where: { id: companyId, type: { in: [...retailTypes] }, isActive: true }, select: { id: true } });
  if (!company) return NextResponse.json({ success: false, error: "Retail operations are not enabled" }, { status: 404 });
  const token = String((await request.json().catch(() => ({}))).token || ""); const preview = takePreview(token, companyId, session.id);
  if (!preview) return NextResponse.json({ success: false, error: "Preview expired. Upload the statement again." }, { status: 410 });
  const fileHash = createHash("sha256").update(preview.bytes).digest("hex");
  if (await prisma.groceryBankStatement.findFirst({ where: { companyId, fileHash }, select: { id: true } })) return NextResponse.json({ success: false, error: "This statement was already imported." }, { status: 409 });
  const ready = preview.rows.filter((row) => row.status === "MATCHED" && row.transactionDate && Number(row.amount) > 0 && row.transactionReference);
  const url = await uploadToR2(`grocery/${companyId}/statements/${fileHash}.pdf`, preview.bytes, "application/pdf");
  const result = await prisma.$transaction(async (tx) => {
    const statement = await tx.groceryBankStatement.create({ data: { companyId, fileUrl: url, fileHash, importedCount: 0, confirmedAt: new Date(), createdById: session.id } });
    let imported = 0; let duplicates = 0; const sales: Array<{ id: string; date: Date; amount: number }> = [];
    for (const row of ready) {
      const reference = row.transactionReference || "KNET-" + createHash("sha256").update(row.rawRowText).digest("hex").slice(0, 20);
      if (await tx.grocerySaleInvoice.findFirst({ where: { companyId, invoiceNumber: reference }, select: { id: true } })) { duplicates++; continue; }
      const sale = await tx.grocerySaleInvoice.create({ data: { companyId, invoiceNumber: reference, date: row.transactionDate!, amount: Number(row.amount), paymentMethod: "KNET", inventoryCost: 0, notes: "KNET statement import: " + row.description, createdById: session.id } });
      sales.push({ id: sale.id, date: sale.date, amount: Number(sale.amount) });
      imported++;
    }
    await tx.groceryBankStatement.update({ where: { id: statement.id }, data: { importedCount: imported } });
    return { imported, duplicates, statementId: statement.id, sales };
  });
  try { for (const sale of result.sales) await postKnetRevenue(companyId, session.id, sale.id, sale.date, sale.amount); }
  catch (error) {
    const ids = result.sales.map((sale) => sale.id);
    if (ids.length) await prisma.grocerySaleInvoice.deleteMany({ where: { id: { in: ids } } });
    await prisma.groceryBankStatement.delete({ where: { id: result.statementId } });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to post KNET revenue" }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: { imported: result.imported, duplicates: result.duplicates, statementId: result.statementId } });
}

