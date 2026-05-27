import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";
import { kuwaitNow } from "@/lib/utils";
import { resolveNotification, upsertNotification } from "@/lib/notifications";
import { createInvestorClaimCollectionJE } from "@/lib/accounting/auto-entries";

interface Props {
  params: Promise<{ claimId: string }>;
}

const patchSchema = z.object({
  action: z.enum([
    "SEND_TO_ACCOUNTANT",
    "SEND_TO_INVESTOR",
    "COLLECT",
    "CONFIRM_EXECUTION",
    "PAY",
    "RENEW",
    "CANCEL",
  ]),
  note: z.string().optional(),
  // للتحصيل: المبالغ المحصلة لكل بند
  collectedLines: z
    .array(z.object({ lineId: z.string(), collectedAmount: z.number().min(0) }))
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
  const { claimId } = await params;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const claim = await prisma.investorClaim.findUnique({
    where: { id: claimId },
    include: { investor: true, lines: true },
  });

  if (!claim) {
    return NextResponse.json({ success: false, error: "المطالبة غير موجودة" }, { status: 404 });
  }

  const action = parsed.data.action;
  const permissionMap = {
    SEND_TO_ACCOUNTANT:  ["INVESTOR_CLAIMS", "UPDATE"]  as const,
    SEND_TO_INVESTOR:    ["INVESTOR_CLAIMS", "COLLECT"] as const,
    COLLECT:             ["INVESTOR_CLAIMS", "COLLECT"] as const,
    CONFIRM_EXECUTION:   ["INVESTOR_CLAIMS", "UPDATE"]  as const,
    PAY:                 ["INVESTOR_CLAIMS", "PAY"]     as const,
    RENEW:               ["INVESTOR_CLAIMS", "PAY"]     as const,
    CANCEL:              ["INVESTOR_CLAIMS", "DELETE"]  as const,
  };
  const [module, permissionAction] = permissionMap[action];

  const permissionError = assertPermission(session, module, permissionAction, {
    companyId: claim.companyId,
    branchId: claim.branchId ?? undefined,
  });
  if (permissionError) return permissionError;

  const now = kuwaitNow();
  let updateData: Record<string, unknown> = {};

  if (action === "SEND_TO_ACCOUNTANT") {
    if (claim.status !== "PENDING" && claim.status !== "OVERDUE") {
      return NextResponse.json({ success: false, error: "المطالبة ليست في حالة تسمح بالإرسال للمحاسب" }, { status: 400 });
    }
    updateData = { status: "SENT_TO_ACCOUNTANT", sentToAccountantAt: now };

  } else if (action === "SEND_TO_INVESTOR") {
    if (claim.status !== "SENT_TO_ACCOUNTANT") {
      return NextResponse.json({ success: false, error: "يجب إرسال المطالبة للمحاسب أولاً" }, { status: 400 });
    }
    updateData = { status: "SENT_TO_INVESTOR", sentToInvestorAt: now };

  } else if (action === "COLLECT") {
    if (!["SENT_TO_ACCOUNTANT", "SENT_TO_INVESTOR", "PARTIALLY_COLLECTED"].includes(claim.status)) {
      return NextResponse.json({ success: false, error: "المطالبة ليست في حالة تسمح بتسجيل التحصيل" }, { status: 400 });
    }

    const { collectedLines } = parsed.data;
    if (!collectedLines || collectedLines.length === 0) {
      return NextResponse.json({ success: false, error: "يرجى إدخال المبالغ المحصلة" }, { status: 400 });
    }

    // تحديث المبالغ المحصلة لكل بند
    await prisma.$transaction(async (tx) => {
      for (const cl of collectedLines) {
        await tx.investorClaimLine.update({
          where: { id: cl.lineId },
          data: { collectedAmount: cl.collectedAmount },
        });
      }
    });

    const totalCollected = collectedLines.reduce((s, l) => s + l.collectedAmount, 0);
    const totalActual = claim.lines.reduce((s, l) => s + Number(l.actualAmount), 0);
    const totalIncome = claim.lines.reduce((s, l) => s + Number(l.groupIncome), 0);

    if (totalCollected > 0) {
      try {
        const entry = await createInvestorClaimCollectionJE({
          companyId: claim.companyId,
          userId: session.id,
          investorId: claim.investorId,
          claimType: claim.type,
          collectedAmount: totalCollected,
          actualAmount: totalActual,
          groupIncome: totalIncome,
          refId: claim.id,
          descriptionAr: claim.descriptionAr,
        });
        updateData.journalEntryId = entry.id;
      } catch (jeError) {
        console.error("JE creation skipped:", jeError);
      }
    }

    updateData = { ...updateData, status: "COLLECTED", collectedAt: now };

  } else if (action === "CONFIRM_EXECUTION") {
    if (claim.status !== "COLLECTED") {
      return NextResponse.json({ success: false, error: "يجب تسجيل التحصيل أولاً قبل تأكيد التنفيذ" }, { status: 400 });
    }
    updateData = { status: "COMPLETED", completedAt: now };

  } else if (action === "PAY") {
    updateData = { status: "PAID", paidAt: now };
  } else if (action === "RENEW") {
    updateData = { status: "RENEWED", renewedAt: now };
  } else if (action === "CANCEL") {
    updateData = { status: "CANCELLED" };
  }

  const updated = await prisma.investorClaim.update({
    where: { id: claimId },
    data: {
      ...updateData,
      notes: parsed.data.note ? `${claim.notes ? `${claim.notes}\n` : ""}${parsed.data.note}` : claim.notes,
    },
  });

  const dueKey = `claim:${claim.id}:due:${claim.dueDate?.toISOString().slice(0, 10) ?? "na"}`;
  if (["COLLECT", "PAY", "RENEW", "CANCEL", "CONFIRM_EXECUTION"].includes(action)) {
    await resolveNotification(dueKey);
  }

  if (action === "SEND_TO_ACCOUNTANT") {
    await upsertNotification({
      type: "FINANCIAL_CLAIM_SENT",
      uniqueKey: `claim:${claim.id}:sent`,
      titleAr: "تم إرسال مطالبة للمحاسب",
      titleEn: "Financial claim sent to accountant",
      messageAr: `تم إرسال مطالبة المسئول ${claim.investor.nameAr} إلى المحاسب`,
      messageEn: `Financial claim for ${claim.investor.nameEn ?? claim.investor.nameAr} was sent to the accountant`,
      companyId: claim.companyId,
      branchId: claim.branchId ?? undefined,
      investorId: claim.investorId,
      entityType: "INVESTOR_CLAIM",
      entityId: claim.id,
      dueDate: claim.dueDate,
      severity: "INFO",
      targetRole: "ACCOUNTANT",
      refModule: "investor_claims",
      refId: claim.id,
    });
  }

  if (action === "COLLECT") {
    await upsertNotification({
      type: "FINANCIAL_CLAIM_SENT",
      uniqueKey: `claim:${claim.id}:collected`,
      titleAr: "تم تحصيل المطالبة",
      titleEn: "Claim collected",
      messageAr: `تم تسجيل تحصيل مطالبة ${claim.investor.nameAr} — يرجى تأكيد تنفيذ الخدمة`,
      messageEn: `Claim for ${claim.investor.nameEn ?? claim.investor.nameAr} was collected — please confirm service execution`,
      companyId: claim.companyId,
      branchId: claim.branchId ?? undefined,
      investorId: claim.investorId,
      entityType: "INVESTOR_CLAIM",
      entityId: claim.id,
      severity: "INFO",
      targetRole: "ADMIN",
      refModule: "investor_claims",
      refId: claim.id,
    });
  }

  return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في تحديث المطالبة";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// Full edit (description, amount lines, type, dueDate)
const claimTypeValues = ["LICENSE_RENEWAL", "RESIDENCY_RENEWAL", "RENT", "SALARY_FUNDING", "ADMIN_FEE", "FINE", "OTHER"] as const;
const editSchema = z.object({
  descriptionAr: z.string().min(1).optional(),
  type: z.enum(claimTypeValues).optional(),
  dueDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  notes: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { claimId } = await params;
    const claim = await prisma.investorClaim.findUnique({ where: { id: claimId } });
    if (!claim) return NextResponse.json({ success: false, error: "المطالبة غير موجودة" }, { status: 404 });

    const permissionError = assertPermission(session, "INVESTOR_CLAIMS", "UPDATE", {
      companyId: claim.companyId,
      branchId: claim.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    if (!["PENDING", "SENT_TO_ACCOUNTANT"].includes(claim.status)) {
      return NextResponse.json(
        { success: false, error: "لا يمكن تعديل مطالبة تم تحصيلها أو إلغاؤها" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updated = await prisma.investorClaim.update({
      where: { id: claimId },
      data: parsed.data,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في التعديل";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { claimId } = await params;
    const claim = await prisma.investorClaim.findUnique({
      where: { id: claimId },
      include: { payments: true },
    });
    if (!claim) return NextResponse.json({ success: false, error: "المطالبة غير موجودة" }, { status: 404 });

    if (!session.isSuperAdmin) {
      return NextResponse.json({ success: false, error: "يلزم صلاحية المشرف العام للحذف" }, { status: 403 });
    }

    if (claim.payments.length > 0) {
      return NextResponse.json(
        { success: false, error: "لا يمكن حذف مطالبة لها مدفوعات مسجلة — استخدم الإلغاء بدلاً من ذلك" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.investorClaimLine.deleteMany({ where: { claimId } });
      await tx.investorClaim.delete({ where: { id: claimId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في الحذف";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
