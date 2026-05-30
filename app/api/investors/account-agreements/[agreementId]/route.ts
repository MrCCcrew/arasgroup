import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ agreementId: string }>;
}

const claimTypeValues = ["LICENSE_RENEWAL", "RESIDENCY_RENEWAL", "RENT", "SALARY_FUNDING", "ADMIN_FEE", "FINE", "OTHER"] as const;
const chargeCategoryValues = [
  "MONTHLY_FEE",
  "ANNUAL_FEE",
  "RENT",
  "LICENSE_ISSUANCE",
  "LICENSE_RENEWAL",
  "EMPLOYEE_RESIDENCY_RENEWAL",
  "INVESTOR_RESIDENCY_RENEWAL",
  "SALARY_FUNDING",
  "OTHER",
] as const;
const billingCycleValues = ["MONTHLY", "ANNUAL", "MANUAL", "ONE_TIME"] as const;

const schema = z.object({
  branchId: z.string().optional().nullable(),
  licenseId: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  titleAr: z.string().min(1),
  titleEn: z.string().optional().nullable(),
  chargeCategory: z.enum(chargeCategoryValues),
  claimType: z.enum(claimTypeValues),
  billingCycle: z.enum(billingCycleValues),
  amount: z.number().positive(),
  dueDay: z.number().int().min(1).max(31).optional().nullable(),
  dueMonth: z.number().int().min(1).max(12).optional().nullable(),
  startDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  nextDueDate: z.string().optional().nullable().transform((v) => (v ? new Date(v) : null)),
  autoCreateClaim: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { agreementId } = await params;

  const agreement = await prisma.investorAccountAgreement.findUnique({ where: { id: agreementId } });
  if (!agreement) {
    return NextResponse.json({ success: false, error: "الاتفاق المالي غير موجود" }, { status: 404 });
  }

  const permissionError = assertPermission(session, "INVESTORS", "UPDATE", { companyId: agreement.companyId, branchId: agreement.branchId ?? undefined });
  if (permissionError) return permissionError;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const updated = await prisma.investorAccountAgreement.update({
    where: { id: agreementId },
    data: {
      branchId: parsed.data.branchId ?? null,
      licenseId: parsed.data.licenseId ?? null,
      employeeId: parsed.data.employeeId ?? null,
      titleAr: parsed.data.titleAr,
      titleEn: parsed.data.titleEn ?? null,
      chargeCategory: parsed.data.chargeCategory,
      claimType: parsed.data.claimType,
      billingCycle: parsed.data.billingCycle,
      amount: parsed.data.amount,
      dueDay: parsed.data.dueDay ?? null,
      dueMonth: parsed.data.dueMonth ?? null,
      startDate: parsed.data.startDate,
      nextDueDate: parsed.data.nextDueDate,
      autoCreateClaim: parsed.data.autoCreateClaim ?? agreement.autoCreateClaim,
      isActive: parsed.data.isActive ?? agreement.isActive,
      notes: parsed.data.notes ?? null,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { agreementId } = await params;

  const agreement = await prisma.investorAccountAgreement.findUnique({ where: { id: agreementId } });
  if (!agreement) {
    return NextResponse.json({ success: false, error: "الاتفاق المالي غير موجود" }, { status: 404 });
  }

  const permissionError = assertPermission(session, "INVESTORS", "UPDATE", { companyId: agreement.companyId, branchId: agreement.branchId ?? undefined });
  if (permissionError) return permissionError;

  await prisma.investorAccountAgreement.delete({ where: { id: agreementId } });
  return NextResponse.json({ success: true });
}
