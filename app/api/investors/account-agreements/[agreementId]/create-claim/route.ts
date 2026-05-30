import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";
import { upsertNotification } from "@/lib/notifications";

interface Props {
  params: Promise<{ agreementId: string }>;
}

function inferDescription(agreement: {
  titleAr: string;
  chargeCategory: string;
  branch: { nameAr: string } | null;
  license: { commercialNameAr: string; licenseNumber: string } | null;
  employee: { nameAr: string } | null;
}) {
  const parts = [agreement.titleAr];
  if (agreement.branch?.nameAr) parts.push(`الفرع: ${agreement.branch.nameAr}`);
  if (agreement.license?.commercialNameAr) parts.push(`الترخيص: ${agreement.license.commercialNameAr}`);
  if (agreement.employee?.nameAr) parts.push(`الموظف: ${agreement.employee.nameAr}`);
  return parts.join(" - ");
}

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { agreementId } = await params;

  const agreement = await prisma.investorAccountAgreement.findUnique({
    where: { id: agreementId },
    include: {
      investor: true,
      branch: { select: { id: true, nameAr: true } },
      license: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
      employee: { select: { id: true, nameAr: true, nameEn: true } },
    },
  });

  if (!agreement) {
    return NextResponse.json({ success: false, error: "الاتفاق المالي غير موجود" }, { status: 404 });
  }

  const permissionError = assertPermission(session, "INVESTOR_CLAIMS", "CREATE", {
    companyId: agreement.companyId,
    branchId: agreement.branchId ?? undefined,
  });
  if (permissionError) return permissionError;

  const now = new Date();
  const claimDate = agreement.nextDueDate ?? now;
  const dueDate = agreement.nextDueDate ?? agreement.startDate ?? now;
  const descriptionAr = inferDescription(agreement);

  const claim = await prisma.investorClaim.create({
    data: {
      investorId: agreement.investorId,
      branchId: agreement.branchId,
      companyId: agreement.companyId,
      type: agreement.claimType,
      descriptionAr,
      descriptionEn: agreement.titleEn ?? null,
      claimDate,
      dueDate,
      notes: agreement.notes ?? null,
      lines: {
        create: [
          {
            descriptionAr: agreement.titleAr,
            actualAmount: agreement.amount,
            collectedAmount: 0,
            groupIncome: 0,
            notes: agreement.notes ?? null,
          },
        ],
      },
      ...(agreement.employee
        ? {
            beneficiaries: {
              create: [
                {
                  employeeId: agreement.employee.id,
                  isInvestor: false,
                  nameAr: agreement.employee.nameAr,
                  nameEn: agreement.employee.nameEn ?? null,
                },
              ],
            },
          }
        : {}),
    },
    include: {
      investor: true,
      lines: true,
    },
  });

  if (claim.dueDate) {
    await upsertNotification({
      type: "INVESTOR_CLAIM_DUE",
      uniqueKey: `claim:${claim.id}:due:${claim.dueDate.toISOString().slice(0, 10)}`,
      titleAr: "استحقاق مطالبة مسئول/مدير",
      titleEn: "Investor account claim due",
      messageAr: `استحقاق مطالبة للمسئول ${agreement.investor.nameAr}`,
      messageEn: `Claim due for ${agreement.investor.nameEn ?? agreement.investor.nameAr}`,
      companyId: agreement.companyId,
      branchId: agreement.branchId ?? undefined,
      investorId: agreement.investorId,
      entityType: "INVESTOR_CLAIM",
      entityId: claim.id,
      dueDate: claim.dueDate,
      severity: "WARNING",
      targetRole: "ACCOUNTANT",
      refModule: "investor_claims",
      refId: claim.id,
    });
  }

  if (agreement.billingCycle === "MONTHLY" || agreement.billingCycle === "ANNUAL") {
    const nextDueDate = new Date(dueDate);
    if (agreement.billingCycle === "MONTHLY") {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    } else {
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
    }
    await prisma.investorAccountAgreement.update({
      where: { id: agreement.id },
      data: { nextDueDate },
    });
  }

  return NextResponse.json({ success: true, data: claim }, { status: 201 });
}
