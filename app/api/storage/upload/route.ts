import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadToR2 } from "@/lib/storage/r2";
import { nanoid } from "nanoid";
import { assertCompanyAccess, assertPermission, requireRequestSession } from "@/lib/auth/access";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = (formData.get("companyId") as string | null) ?? "";
    const branchId = (formData.get("branchId") as string | null) ?? undefined;
    const entityType = (formData.get("entityType") as string | null) ?? undefined;
    const entityId = (formData.get("entityId") as string | null) ?? undefined;
    const attachmentType = (formData.get("attachmentType") as string | null) ?? undefined;
    const notes = (formData.get("notes") as string | null) ?? undefined;
    const clientGeneratedId = (formData.get("clientGeneratedId") as string | null) ?? undefined;
    const refModule = (formData.get("refModule") as string | null) ?? entityType ?? "GENERIC";
    const refId = (formData.get("refId") as string | null) ?? entityId ?? "";

    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم إرسال ملف" }, { status: 400 });
    }
    if (!companyId || !entityType || !entityId) {
      return NextResponse.json({ success: false, error: "companyId و entityType و entityId مطلوبة" }, { status: 400 });
    }

    const companyAccessError = assertCompanyAccess(session, companyId);
    if (companyAccessError) return companyAccessError;
    const permissionError = assertPermission(session, "ATTACHMENTS", "UPLOAD", { companyId, branchId });
    if (permissionError) return permissionError;

    const mimeType = file.type;
    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
      return NextResponse.json({ success: false, error: "نوع الملف غير مدعوم" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "حجم الملف يتجاوز 10 ميجابايت" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uniqueId = nanoid(12);
    const key = `${entityType.toLowerCase()}/${entityId}/${uniqueId}.${ext}`;
    const publicUrl = await uploadToR2(key, buffer, mimeType);

    const attachment = await prisma.attachment.create({
      data: {
        companyId,
        branchId,
        entityType,
        entityId,
        attachmentType,
        fileName: key,
        originalName: file.name,
        fileType: mimeType,
        mimeType,
        fileSize: file.size,
        filePath: publicUrl,
        storagePath: key,
        refModule,
        refId,
        uploadedById: session.id,
        notes,
        clientGeneratedId,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        companyId,
        branchId,
        action: "UPLOAD_ATTACHMENT",
        module: "attachments",
        resourceId: attachment.id,
        resourceType: entityType,
        newValues: { attachmentType, fileName: file.name, entityId },
        ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "",
        userAgent: request.headers.get("user-agent") ?? "",
      },
    });

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, error: "فشل في رفع الملف" }, { status: 500 });
  }
}
