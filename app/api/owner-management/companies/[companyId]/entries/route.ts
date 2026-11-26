import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { canManageOwnerEntries, forbidden, requireOwnerManagedCompany } from "@/lib/owner-management/access";
import { entryDate, entrySchema } from "@/lib/owner-management/entries";

export async function POST(request: NextRequest, { params }: { params: Promise<{ companyId: string }> }) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { companyId } = await params;
  if (!canManageOwnerEntries(session) || !await requireOwnerManagedCompany(session, companyId)) return forbidden();
  const parsed = entrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "راجع الشريك والتاريخ والمبلغ (حتى 3 منازل عشرية)." }, { status: 400 });
  const input = parsed.data;
  const partner = await prisma.ownerManagedPartner.findFirst({ where: { id: input.partnerId, companyId, isActive: true } });
  if (!partner) return NextResponse.json({ success: false, error: "الشريك غير متاح في هذه الشركة." }, { status: 400 });
  const revenue = input.kind === "revenue" || input.kind === "receipt";
  const title = { revenue: "إيراد يدوي", expense: "مصروف يدوي", receipt: "سند قبض", payment: "سند صرف" }[input.kind];
  const reference = `${revenue ? "RCV" : "PAY"}-${randomUUID()}`;
  const description = `${title} — ${reference}${input.notes ? `\n${input.notes}` : ""}`;
  try {
    const row = await prisma.$transaction(async tx => {
      // Keep the source record used by existing partner deposit receipts.
      const source = revenue ? await tx.ownerManagedStatementImport.create({ data: { companyId, fileName: title, fileHash: reference, importedById: session.id, confirmedAt: new Date() } }) : null;
      const data = revenue
        ? await tx.ownerManagedRevenue.create({ data: {
          companyId, partnerId: partner.id, mid: partner.mid, transactionReference: reference,
          transactionDate: entryDate(input.date), postingDate: entryDate(input.date),
          amount: input.amount.toFixed(3), description, pageNumber: 1, status: "MATCHED",
          importId: source!.id,
        } })
        : await tx.ownerManagedExpense.create({ data: {
          companyId, partnerId: partner.id, invoiceDate: entryDate(input.date)!,
          amount: input.amount.toFixed(3), notes: description, createdById: session.id,
        } });
      await tx.auditLog.create({ data: { userId: session.id, companyId, action: revenue ? "CREATE_OWNER_MANAGED_REVENUE" : "CREATE_OWNER_MANAGED_EXPENSE", module: "owner_management", resourceId: data.id, resourceType: revenue ? "OwnerManagedRevenue" : "OwnerManagedExpense", newValues: { kind: input.kind, reference } } });
      return data;
    });
    return NextResponse.json({ success: true, data: { id: row.id, type: revenue ? "revenues" : "expenses" } }, { status: 201 });
  } catch (error) {
    console.error("Owner managed entry creation failed", error);
    return NextResponse.json({ success: false, error: "تعذر حفظ العملية. حاول مرة أخرى." }, { status: 500 });
  }
}
