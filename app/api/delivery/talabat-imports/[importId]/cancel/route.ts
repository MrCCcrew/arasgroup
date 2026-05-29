import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, requireRequestSession } from "@/lib/auth/access";

interface Ctx { params: Promise<{ importId: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { importId } = await params;
  const imp = await prisma.talabatReportImport.findUnique({
    where: { id: importId }, select: { companyId: true, status: true },
  });
  if (!imp) return NextResponse.json({ success: false, error: "التقرير غير موجود" }, { status: 404 });
  if (imp.status === "POSTED") {
    return NextResponse.json({ success: false, error: "لا يمكن إلغاء تقرير مرحّل بالفعل" }, { status: 400 });
  }

  const err = assertCompanyAccess(session, imp.companyId);
  if (err) return err;

  await prisma.talabatReportImport.update({
    where: { id: importId },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ success: true });
}
