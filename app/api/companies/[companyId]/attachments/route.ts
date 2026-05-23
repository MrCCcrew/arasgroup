import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteFromR2 } from "@/lib/storage/r2";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

interface Ctx {
  params: Promise<{ companyId: string }>;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { companyId } = await params;

  const companyAccessError = assertCompanyAccess(session, companyId);
  if (companyAccessError) return companyAccessError;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") ?? undefined;

  try {
    const attachments = await prisma.attachment.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(entityType ? { entityType } : {}),
      },
      include: {
        uploadedBy: { select: { nameAr: true, nameEn: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في جلب المرفقات" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { companyId } = await params;
  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("id");

  if (!attachmentId) {
    return NextResponse.json({ success: false, error: "id مطلوب" }, { status: 400 });
  }

  try {
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, companyId, deletedAt: null },
    });
    if (!attachment) {
      return NextResponse.json({ success: false, error: "المرفق غير موجود" }, { status: 404 });
    }

    const permissionError = assertPermission(session, "ATTACHMENTS", "DELETE", {
      companyId,
      branchId: attachment.branchId ?? undefined,
    });
    if (permissionError) return permissionError;

    if (attachment.storagePath) {
      await deleteFromR2(attachment.storagePath);
    } else {
      await deleteFromR2(attachment.fileName);
    }

    await prisma.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId,
        branchId: attachment.branchId,
        action: "DELETE_ATTACHMENT",
        module: "attachments",
        resourceId: attachment.id,
        resourceType: attachment.entityType ?? "Attachment",
        oldValues: { fileName: attachment.originalName, attachmentType: attachment.attachmentType },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في حذف المرفق" }, { status: 500 });
  }
}
