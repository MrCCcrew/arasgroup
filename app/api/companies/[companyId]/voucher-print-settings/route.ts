import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";
import { hasPermission } from "@/lib/auth/permissions";
import { defaultVoucherPrintSettings, voucherPrintSettingsSchema } from "@/lib/accounting/voucher-print-settings";

type Props = { params: Promise<{ companyId: string }> };
async function access(request: NextRequest, companyId: string, edit = false) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const denied = assertCompanyAccess(session, companyId) ?? assertPermission(session, "ACCOUNTING", edit ? "UPDATE" : "VIEW", { companyId });
  if (denied) return denied;
  if (!await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }))
    return NextResponse.json({ success: false, error: "الشركة غير موجودة" }, { status: 404 });
  return session;
}
export async function GET(request: NextRequest, { params }: Props) {
  const { companyId } = await params;
  const session = await access(request, companyId);
  if (session instanceof NextResponse) return session;
  const settings = await prisma.companyVoucherPrintSettings.findUnique({ where: { companyId }, select: { copies: true, orientation: true } });
  return NextResponse.json({ success: true, data: settings ?? defaultVoucherPrintSettings, canEdit: hasPermission(session, "ACCOUNTING", "UPDATE", { companyId }) });
}
export async function PUT(request: NextRequest, { params }: Props) {
  const { companyId } = await params;
  const session = await access(request, companyId, true);
  if (session instanceof NextResponse) return session;
  const parsed = voucherPrintSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: "اختر نسخة أو نسختين واتجاه الورقة" }, { status: 400 });
  const data = await prisma.$transaction(async tx => {
    const oldValues = await tx.companyVoucherPrintSettings.findUnique({ where: { companyId } });
    const settings = await tx.companyVoucherPrintSettings.upsert({ where: { companyId }, create: { companyId, ...parsed.data }, update: parsed.data, select: { copies: true, orientation: true } });
    await tx.auditLog.create({ data: { userId: session.id, companyId, action: "UPDATE", module: "accounting", resourceType: "VoucherPrintSettings", resourceId: companyId, oldValues: oldValues ? { copies: oldValues.copies, orientation: oldValues.orientation } : defaultVoucherPrintSettings, newValues: parsed.data } });
    return settings;
  });
  return NextResponse.json({ success: true, data });
}
