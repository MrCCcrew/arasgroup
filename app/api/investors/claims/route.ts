import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ClaimStatus, ClaimType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { upsertNotification } from "@/lib/notifications";

const claimLineSchema = z.object({
  descriptionAr: z.string(),
  // collectedAmount يُدخله المحاسب لاحقاً عند تسجيل التحصيل — ليس في نموذج الإنشاء
  collectedAmount: z.number().min(0).default(0),
  actualAmount: z.number().min(0),
  groupIncome: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const createClaimSchema = z.object({
  investorId: z.string(),
  branchId: z.string().optional(),
  companyId: z.string(),
  type: z.enum(["LICENSE_RENEWAL", "RESIDENCY_RENEWAL", "RENT", "SALARY_FUNDING", "ADMIN_FEE", "FINE", "OTHER"]),
  descriptionAr: z.string().min(3),
  claimDate: z.string().transform((value) => new Date(value)),
  dueDate: z.string().optional().transform((value) => (value ? new Date(value) : undefined)),
  lines: z.array(claimLineSchema).min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const investorId = searchParams.get("investorId");
    const companyId = searchParams.get("companyId");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    if (!companyId) {
      return NextResponse.json({ success: false, error: "معرف الشركة مطلوب" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "INVESTOR_CLAIMS", "VIEW", { companyId });
    if (permissionError) return permissionError;

    const claims = await prisma.investorClaim.findMany({
      where: {
        companyId,
        ...(investorId ? { investorId } : {}),
        ...(status ? { status: status as ClaimStatus } : {}),
        ...(type ? { type: type as ClaimType } : {}),
      },
      include: {
        investor: { select: { nameAr: true, phone: true } },
        branch: { select: { nameAr: true } },
        lines: true,
        payments: true,
      },
      orderBy: { claimDate: "desc" },
    });

    return NextResponse.json({ success: true, data: claims });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب مطالبات المستثمرين" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createClaimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, investorId, branchId, type, descriptionAr, claimDate, dueDate, notes, lines } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "INVESTOR_CLAIMS", "CREATE", { companyId, branchId });
    if (permissionError) return permissionError;

    // الإنشاء بحالة PENDING — المحاسب هو من يسجل التحصيل لاحقاً
    const claim = await prisma.investorClaim.create({
      data: {
        investorId,
        branchId,
        companyId,
        type,
        descriptionAr,
        claimDate,
        dueDate,
        notes,
        lines: {
          create: lines.map((line) => ({
            descriptionAr: line.descriptionAr,
            collectedAmount: 0, // يُملأ لاحقاً من المحاسب
            actualAmount: line.actualAmount,
            groupIncome: line.groupIncome,
            notes: line.notes,
          })),
        },
      },
      include: { lines: true, investor: true },
    });

    if (claim.dueDate) {
      await upsertNotification({
        type: "INVESTOR_CLAIM_DUE",
        uniqueKey: `claim:${claim.id}:due:${claim.dueDate.toISOString().slice(0, 10)}`,
        titleAr: "استحقاق مطالبة مسئول",
        titleEn: "Investor claim due",
        messageAr: `مطالبة المسئول ${claim.investor.nameAr} مستحقة قريباً`,
        messageEn: `Investor claim for ${claim.investor.nameEn ?? claim.investor.nameAr} is due soon`,
        companyId,
        branchId: claim.branchId ?? undefined,
        investorId,
        entityType: "INVESTOR_CLAIM",
        entityId: claim.id,
        dueDate: claim.dueDate,
        severity: "WARNING",
        targetRole: "ACCOUNTANT",
        refModule: "investor_claims",
        refId: claim.id,
      });
    }

    return NextResponse.json({ success: true, data: claim }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في إنشاء مطالبة المستثمر";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
