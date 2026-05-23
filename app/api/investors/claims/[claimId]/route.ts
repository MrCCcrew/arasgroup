import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";
import { kuwaitNow } from "@/lib/utils";
import { resolveNotification, upsertNotification } from "@/lib/notifications";

interface Props {
  params: Promise<{ claimId: string }>;
}

const patchSchema = z.object({
  action: z.enum(["SEND_TO_ACCOUNTANT", "COLLECT", "PAY", "RENEW", "CANCEL"]),
  note: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
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
    SEND_TO_ACCOUNTANT: ["INVESTOR_CLAIMS", "UPDATE"] as const,
    COLLECT: ["INVESTOR_CLAIMS", "COLLECT"] as const,
    PAY: ["INVESTOR_CLAIMS", "PAY"] as const,
    RENEW: ["INVESTOR_CLAIMS", "PAY"] as const,
    CANCEL: ["INVESTOR_CLAIMS", "DELETE"] as const,
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
    updateData = { status: "SENT_TO_ACCOUNTANT", sentToAccountantAt: now };
  } else if (action === "COLLECT") {
    updateData = { status: "COLLECTED", collectedAt: now };
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
  if (action === "COLLECT" || action === "PAY" || action === "RENEW" || action === "CANCEL") {
    await resolveNotification(dueKey);
  }

  if (action === "SEND_TO_ACCOUNTANT") {
    await upsertNotification({
      type: "FINANCIAL_CLAIM_SENT",
      uniqueKey: `claim:${claim.id}:sent`,
      titleAr: "تم إرسال المطالبة إلى المحاسب",
      titleEn: "Financial claim sent to accountant",
      messageAr: `تم إرسال مطالبة المستثمر ${claim.investor.nameAr} إلى المحاسب`,
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

  return NextResponse.json({ success: true, data: updated });
}
