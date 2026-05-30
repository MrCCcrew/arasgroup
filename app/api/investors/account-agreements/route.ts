import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

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
  companyId: z.string(),
  investorId: z.string(),
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
  notes: z.string().optional().nullable(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const investorId = searchParams.get("investorId");
  if (!companyId) {
    return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });
  }

  const companyError = assertCompanyAccess(session, companyId);
  if (companyError) return companyError;
  const permissionError = assertPermission(session, "INVESTORS", "VIEW", { companyId });
  if (permissionError) return permissionError;

  const agreements = await prisma.investorAccountAgreement.findMany({
    where: {
      companyId,
      ...(investorId ? { investorId } : {}),
    },
    include: {
      branch: { select: { id: true, nameAr: true, nameEn: true } },
      license: { select: { id: true, commercialNameAr: true, licenseNumber: true } },
      employee: { select: { id: true, nameAr: true, nameEn: true } },
    },
    orderBy: [{ isActive: "desc" }, { titleAr: "asc" }],
  });

  return NextResponse.json({ success: true, data: agreements });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data = parsed.data;
  const companyError = assertCompanyAccess(session, data.companyId);
  if (companyError) return companyError;
  const permissionError = assertPermission(session, "INVESTORS", "UPDATE", { companyId: data.companyId, branchId: data.branchId ?? undefined });
  if (permissionError) return permissionError;

  const agreement = await prisma.investorAccountAgreement.create({
    data: {
      companyId: data.companyId,
      investorId: data.investorId,
      branchId: data.branchId ?? null,
      licenseId: data.licenseId ?? null,
      employeeId: data.employeeId ?? null,
      titleAr: data.titleAr,
      titleEn: data.titleEn ?? null,
      chargeCategory: data.chargeCategory,
      claimType: data.claimType,
      billingCycle: data.billingCycle,
      amount: data.amount,
      dueDay: data.dueDay ?? null,
      dueMonth: data.dueMonth ?? null,
      startDate: data.startDate,
      nextDueDate: data.nextDueDate,
      autoCreateClaim: data.autoCreateClaim ?? false,
      notes: data.notes ?? null,
    },
  });

  return NextResponse.json({ success: true, data: agreement }, { status: 201 });
}
