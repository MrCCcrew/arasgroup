import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession, assertCompanyAccess } from "@/lib/auth/access";
import { recomputeDriverWalletState } from "@/lib/delivery/wallet-state";

const schema = z.object({
  driverId: z.string().min(1),
  companyId: z.string().min(1),
  descriptionAr: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { driverId, companyId, descriptionAr } = parsed.data;
    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;

    const driver = await prisma.driver.findFirst({
      where: { id: driverId, employee: { companyId } },
      select: { id: true, walletBalance: true, employee: { select: { nameAr: true } } },
    });
    if (!driver) {
      return NextResponse.json({ success: false, error: "السائق غير موجود في هذه الشركة" }, { status: 404 });
    }

    const balance = Number(driver.walletBalance);
    if (Math.abs(balance) < 0.0005) {
      return NextResponse.json({ success: false, error: "رصيد السائق صفر بالفعل" }, { status: 400 });
    }

    if (balance < 0) {
      return NextResponse.json(
        {
          success: false,
          error: "التسوية اليدوية متاحة فقط عندما يكون السائق مديناً للشركة. الرصيد السالب يعني أن الشركة مدينة للسائق ويجب معالجته بقيد صحيح أو عكس الحركة الخاطئة.",
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.driverWalletTransaction.create({
        data: {
          driverId,
          type: "SETTLEMENT",
          amount: balance,
          date: new Date(),
          descriptionAr: descriptionAr ?? `تسوية وتصفير رصيد المحفظة (${balance.toFixed(3)} د.ك)`,
          isSettled: true,
          settledAt: new Date(),
        },
      });

      await recomputeDriverWalletState(tx, driverId);
    });

    return NextResponse.json({ success: true, previousBalance: balance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل في تسوية الرصيد";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
