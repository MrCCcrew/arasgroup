import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AssetCustodyStatus } from "@prisma/client";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const statusFilter = searchParams.get("status") ?? undefined;

  if (!companyId) return NextResponse.json({ success: false, error: "companyId مطلوب" }, { status: 400 });

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const custodies = await prisma.assetCustody.findMany({
    where: {
      companyId,
      ...(statusFilter ? { status: statusFilter as AssetCustodyStatus } : {}),
    },
    include: {
      assetItem: {
        include: { assetItemType: { select: { nameAr: true, nameEn: true } } },
      },
      employee: { select: { nameAr: true, nameEn: true } },
      driver: { select: { employee: { select: { nameAr: true, nameEn: true } } } },
      assignedBy: { select: { nameAr: true, nameEn: true } },
    },
    orderBy: { assignedDate: "desc" },
  });

  return NextResponse.json({ success: true, data: custodies });
}

const createSchema = z.object({
  companyId: z.string().min(1),
  branchId: z.string().optional(),
  assetItemId: z.string().min(1),
  assignmentTargetType: z.enum(["EMPLOYEE", "DRIVER", "VEHICLE", "CAR_WASH_VEHICLE", "BRANCH", "COMPANY"]),
  assignmentTargetId: z.string().min(1),
  employeeId: z.string().optional(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
  carWashVehicleId: z.string().optional(),
  assignedDate: z.string().transform((s) => new Date(s)),
  conditionOnAssign: z.enum(["NEW", "GOOD", "USED", "DAMAGED", "LOST", "UNDER_MAINTENANCE"]).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  const companyAccessError = assertCompanyAccess(session, parsed.data.companyId);
  if (companyAccessError) return companyAccessError;

  const item = await prisma.assetItem.findFirst({
    where: { id: parsed.data.assetItemId, companyId: parsed.data.companyId, deletedAt: null },
    select: { status: true },
  });
  if (!item) {
    return NextResponse.json({ success: false, error: "الصنف غير موجود" }, { status: 404 });
  }
  if (item.status === "ASSIGNED") {
    return NextResponse.json({ success: false, error: "الصنف مُسلَّم بالفعل" }, { status: 409 });
  }

  const [custody] = await prisma.$transaction([
    prisma.assetCustody.create({
      data: { ...parsed.data, assignedById: session.id, status: "ACTIVE" },
    }),
    prisma.assetItem.update({
      where: { id: parsed.data.assetItemId },
      data: { status: "ASSIGNED" },
    }),
  ]);

  return NextResponse.json({ success: true, data: custody }, { status: 201 });
}
