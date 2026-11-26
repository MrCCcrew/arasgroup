import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createDriverTalabatDirectDepositJE, createDriverWalletDepositJE } from "@/lib/accounting/auto-entries";
import { TALABAT_DEPOSIT_METHOD } from "@/lib/delivery/driver-cash-summary";
import { recomputeDriverWalletState } from "@/lib/delivery/wallet-state";

const updateSchema = z.object({ amount: z.number().positive().optional(), depositDate: z.string().optional(), notes: z.string().max(5000).nullable().optional(), transactionReference: z.string().max(200).nullable().optional(), status: z.enum(["APPROVED", "REJECTED"]).optional(), rejectionReason: z.string().min(3).max(500).optional(), talabatAmount: z.number().min(0).optional(), companyAmount: z.number().min(0).optional() });
async function record(request: NextRequest, id: string) { const session = await getSession(); if (!session) return [null, null] as const; const row = await prisma.driverDepositSubmission.findFirst({ where: { id, deletedAt: null, ...(session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } }) } }); return [session, row] as const; }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const [session, row] = await record(request, id); if (!session || !row) return NextResponse.json({ success: false, error: "غير مصرح أو الإيصال غير موجود" }, { status: 404 });
  const input = updateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ success: false, error: "بيانات غير صالحة" }, { status: 400 }); const data = input.data;
  const action = data.status ? (data.status === "APPROVED" ? "APPROVE" : "REJECT") : "UPDATE";
  if (!hasPermission(session, "DRIVER_INVOICES", action, { companyId: row.companyId })) return NextResponse.json({ success: false, error: "لا تملك صلاحية مراجعة الإيداعات" }, { status: 403 });
  if (data.status === "APPROVED") {
    if (row.reviewStatus !== "PENDING_REVIEW") return NextResponse.json({ success: false, error: "تمت مراجعة الإيصال مسبقًا" }, { status: 409 });
    // التقسيم: إيداع مباشر لطلبات + إيداع للشركة. لو مفيش تقسيم → الطريقة القديمة (كله للشركة).
    const split = data.talabatAmount !== undefined || data.companyAmount !== undefined;
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const talabatAmount = round3(split ? data.talabatAmount ?? 0 : 0);
    const companyAmount = round3(split ? data.companyAmount ?? 0 : data.amount ?? Number(row.amount));
    const amount = round3(talabatAmount + companyAmount);
    if (amount <= 0) return NextResponse.json({ success: false, error: "لازم تكتب مبلغ في إيداع طلبات أو إيداع الشركة" }, { status: 400 });
    if (talabatAmount > 0) {
      const custody = await prisma.chartOfAccount.findFirst({ where: { companyId: row.companyId, code: "2031", type: "LIABILITY", isActive: true }, select: { id: true } });
      if (!custody) return NextResponse.json({ success: false, error: "حساب 2031 (أمانات لشركة طلبات) غير موجود في دليل حسابات الشركة — لا يمكن تسجيل إيداع طلبات" }, { status: 400 });
    }
    const depositDate = data.depositDate ? new Date(data.depositDate) : row.depositDate;
    const baseNote = (data.notes ?? row.notes ?? "").trim();
    const updated = await prisma.$transaction(async (tx) => {
      let linkedWalletId: string | null = null;
      if (companyAmount > 0) {
        const descriptionAr = (split && talabatAmount > 0 ? `إيداع الشركة${baseNote ? ` — ${baseNote}` : ""}` : baseNote).slice(0, 160);
        const wallet = await tx.driverWalletTransaction.create({ data: { driverId: row.driverId, type: "DEPOSIT", amount: companyAmount, date: depositDate, paymentMethod: "BANK", descriptionAr } });
        const je = await createDriverWalletDepositJE({ companyId: row.companyId, userId: session.id, driverId: row.driverId, amount: companyAmount, isBankDeposit: true, refId: wallet.id, descriptionAr, date: depositDate });
        await tx.driverWalletTransaction.update({ where: { id: wallet.id }, data: { journalEntryId: je.id } });
        linkedWalletId = wallet.id;
      }
      if (talabatAmount > 0) {
        const descriptionAr = `إيداع مباشر لشركة طلبات${baseNote ? ` — ${baseNote}` : ""} (إيصال ${row.id})`.slice(0, 160);
        const wallet = await tx.driverWalletTransaction.create({ data: { driverId: row.driverId, type: "DEPOSIT", amount: talabatAmount, date: depositDate, paymentMethod: TALABAT_DEPOSIT_METHOD, descriptionAr } });
        const je = await createDriverTalabatDirectDepositJE({ companyId: row.companyId, userId: session.id, driverId: row.driverId, amount: talabatAmount, refId: wallet.id, descriptionAr, date: depositDate });
        await tx.driverWalletTransaction.update({ where: { id: wallet.id }, data: { journalEntryId: je.id } });
        linkedWalletId ??= wallet.id;
      }
      await recomputeDriverWalletState(tx, row.driverId);
      const notes = split ? [baseNote, `إيداع طلبات: ${talabatAmount.toFixed(3)} · إيداع الشركة: ${companyAmount.toFixed(3)}`].filter(Boolean).join("\n") : data.notes;
      return tx.driverDepositSubmission.update({ where: { id }, data: { amount: new Prisma.Decimal(amount), depositDate: data.depositDate ? new Date(data.depositDate) : undefined, notes, transactionReference: data.transactionReference, reviewStatus: "APPROVED", reviewedById: session.id, reviewedAt: new Date(), walletTransactionId: linkedWalletId, rejectionReason: null } });
    }, { timeout: 30000 }); return NextResponse.json({ success: true, data: updated });
  }
  if (data.status === "REJECTED" && row.reviewStatus === "PENDING_REVIEW") { const updated = await prisma.driverDepositSubmission.update({ where: { id }, data: { reviewStatus: "REJECTED", rejectionReason: data.rejectionReason, reviewedById: session.id, reviewedAt: new Date() } }); return NextResponse.json({ success: true, data: updated }); }
  const updated = await prisma.driverDepositSubmission.update({ where: { id }, data: { amount: data.amount === undefined ? undefined : new Prisma.Decimal(data.amount), depositDate: data.depositDate ? new Date(data.depositDate) : undefined, notes: data.notes, transactionReference: data.transactionReference } }); return NextResponse.json({ success: true, data: updated });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [session, row] = await record(request, id); if (!session || !row || !hasPermission(session, "DRIVER_INVOICES", "DELETE", { companyId: row.companyId })) return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 }); if (row.reviewStatus === "APPROVED") return NextResponse.json({ success: false, error: "لا يمكن حذف إيداع معتمد" }, { status: 409 }); await prisma.driverDepositSubmission.update({ where: { id }, data: { deletedAt: new Date() } }); return NextResponse.json({ success: true }); }



