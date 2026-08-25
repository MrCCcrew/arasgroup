import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { createDriverWalletDepositJE } from "@/lib/accounting/auto-entries";
import { recomputeDriverWalletState } from "@/lib/delivery/wallet-state";

const updateSchema = z.object({ amount: z.number().positive().optional(), depositDate: z.string().optional(), notes: z.string().max(5000).nullable().optional(), transactionReference: z.string().max(200).nullable().optional(), status: z.enum(["APPROVED", "REJECTED"]).optional(), rejectionReason: z.string().min(3).max(500).optional() });
async function record(request: NextRequest, id: string) { const session = await getSession(); if (!session) return [null, null] as const; const row = await prisma.driverDepositSubmission.findFirst({ where: { id, deletedAt: null, ...(session.isSuperAdmin ? {} : { companyId: { in: session.companyAccess } }) } }); return [session, row] as const; }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const [session, row] = await record(request, id); if (!session || !row) return NextResponse.json({ success: false, error: "غير مصرح أو الإيصال غير موجود" }, { status: 404 });
  const input = updateSchema.safeParse(await request.json()); if (!input.success) return NextResponse.json({ success: false, error: "بيانات غير صالحة" }, { status: 400 }); const data = input.data;
  const action = data.status ? (data.status === "APPROVED" ? "APPROVE" : "REJECT") : "UPDATE";
  if (!hasPermission(session, "DRIVER_INVOICES", action, { companyId: row.companyId })) return NextResponse.json({ success: false, error: "لا تملك صلاحية مراجعة الإيداعات" }, { status: 403 });
  if (data.status === "APPROVED") {
    if (row.reviewStatus !== "PENDING_REVIEW") return NextResponse.json({ success: false, error: "تمت مراجعة الإيصال مسبقًا" }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => { const amount = data.amount ?? Number(row.amount); const wallet = await tx.driverWalletTransaction.create({ data: { driverId: row.driverId, type: "DEPOSIT", amount, date: data.depositDate ? new Date(data.depositDate) : row.depositDate, paymentMethod: "BANK", descriptionAr: data.notes ?? row.notes ?? "إيداع مرفوع من السائق" } }); const je = await createDriverWalletDepositJE({ companyId: row.companyId, userId: session.id, driverId: row.driverId, amount, isBankDeposit: true, refId: wallet.id, descriptionAr: data.notes ?? row.notes ?? "إيداع مرفوع من السائق", date: data.depositDate ? new Date(data.depositDate) : row.depositDate }); await tx.driverWalletTransaction.update({ where: { id: wallet.id }, data: { journalEntryId: je.id } }); await recomputeDriverWalletState(tx, row.driverId); return tx.driverDepositSubmission.update({ where: { id }, data: { amount: new Prisma.Decimal(amount), depositDate: data.depositDate ? new Date(data.depositDate) : undefined, notes: data.notes, transactionReference: data.transactionReference, reviewStatus: "APPROVED", reviewedById: session.id, reviewedAt: new Date(), walletTransactionId: wallet.id, rejectionReason: null } }); }); return NextResponse.json({ success: true, data: updated });
  }
  if (data.status === "REJECTED" && row.reviewStatus === "PENDING_REVIEW") { const updated = await prisma.driverDepositSubmission.update({ where: { id }, data: { reviewStatus: "REJECTED", rejectionReason: data.rejectionReason, reviewedById: session.id, reviewedAt: new Date() } }); return NextResponse.json({ success: true, data: updated }); }
  const updated = await prisma.driverDepositSubmission.update({ where: { id }, data: { amount: data.amount === undefined ? undefined : new Prisma.Decimal(data.amount), depositDate: data.depositDate ? new Date(data.depositDate) : undefined, notes: data.notes, transactionReference: data.transactionReference } }); return NextResponse.json({ success: true, data: updated });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [session, row] = await record(request, id); if (!session || !row || !hasPermission(session, "DRIVER_INVOICES", "DELETE", { companyId: row.companyId })) return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 }); if (row.reviewStatus === "APPROVED") return NextResponse.json({ success: false, error: "لا يمكن حذف إيداع معتمد" }, { status: 409 }); await prisma.driverDepositSubmission.update({ where: { id }, data: { deletedAt: new Date() } }); return NextResponse.json({ success: true }); }
