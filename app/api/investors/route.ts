import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

const branchLinkSchema = z.object({
  branchId: z.string(),
  ownershipPct: z.number().min(0).max(100).default(100),
  startDate: z.string().transform((s) => new Date(s)),
  notes: z.string().optional(),
});

const createSchema = z.object({
  companyId: z.string(),
  nameAr: z.string().min(2, "الاسم مطلوب"),
  nameEn: z.string().optional(),
  phone: z.string().optional(),
  phone2: z.string().optional(),
  civilId: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  branchLinks: z.array(branchLinkSchema).default([]),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    if (companyId) {
      const companyAccessError = assertCompanyAccess(session, companyId);
      if (companyAccessError) return companyAccessError;
    }

    // ── فلتر الشركة يعتمد على علاقة companies (المنشأة بـ POST عبر connect)
    // وليس investorBranches، حتى تظهر المستثمرون قبل ربطهم بفروع ──
    const investors = await prisma.investor.findMany({
      where: {
        isActive: true,
        ...(companyId
          ? { companies: { some: { id: companyId } } }
          : {}),
      },
      include: {
        investorBranches: {
          where: { isActive: true },
          include: { branch: { select: { nameAr: true } } },
        },
      },
      orderBy: { nameAr: "asc" },
    });

    return NextResponse.json({ success: true, data: investors });
  } catch {
    return NextResponse.json({ success: false, error: "فشل في جلب المستثمرين" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { companyId, branchLinks, ...investorData } = parsed.data;

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const investor = await prisma.$transaction(async (tx) => {
      const inv = await tx.investor.create({
        data: {
          ...investorData,
          companies: { connect: { id: companyId } },
        },
      });

      if (branchLinks.length > 0) {
        await tx.investorBranch.createMany({
          data: branchLinks.map((l) => ({
            investorId: inv.id,
            branchId: l.branchId,
            ownershipPct: l.ownershipPct,
            startDate: l.startDate,
            notes: l.notes,
          })),
        });
      }

      return inv;
    });

    return NextResponse.json({ success: true, data: investor }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء المستثمر";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
