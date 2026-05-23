import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ id: string }>;
}

const returnSchema = z.object({
  returnedDate: z.string().transform((s) => new Date(s)),
  conditionOnReturn: z.enum(["NEW", "GOOD", "USED", "DAMAGED", "LOST", "UNDER_MAINTENANCE"]).optional(),
  custodyStatus: z.enum(["RETURNED", "LOST", "DAMAGED"]).default("RETURNED"),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await request.json();
  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const custody = await prisma.assetCustody.findFirst({
    where: { id, status: "ACTIVE" },
    select: { companyId: true, assetItemId: true },
  });
  if (!custody) {
    return NextResponse.json({ success: false, error: "العهدة غير موجودة أو تم إرجاعها مسبقاً" }, { status: 404 });
  }

  const companyAccessError = assertCompanyAccess(session, custody.companyId);
  if (companyAccessError) return companyAccessError;

  const newItemStatus =
    parsed.data.custodyStatus === "LOST"
      ? "LOST"
      : parsed.data.custodyStatus === "DAMAGED"
      ? "DAMAGED"
      : "AVAILABLE";

  await prisma.$transaction([
    prisma.assetCustody.update({
      where: { id },
      data: {
        status: parsed.data.custodyStatus,
        returnedDate: parsed.data.returnedDate,
        conditionOnReturn: parsed.data.conditionOnReturn,
        returnedToId: session.id,
        notes: parsed.data.notes,
      },
    }),
    prisma.assetItem.update({
      where: { id: custody.assetItemId },
      data: {
        status: newItemStatus,
        currentCondition: parsed.data.conditionOnReturn ?? undefined,
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}
