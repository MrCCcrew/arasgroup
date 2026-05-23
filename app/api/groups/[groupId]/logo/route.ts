import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";
import { requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ groupId: string }>;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح — يلزم صلاحية المشرف العام" }, { status: 403 });
  }

  try {
    const { groupId } = await params;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, logoUrl: true },
    });
    if (!group) {
      return NextResponse.json({ success: false, error: "المجموعة غير موجودة" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم إرسال ملف" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: "نوع الملف غير مدعوم — يُقبل: JPG, PNG, WebP, SVG" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "حجم الملف يتجاوز 2 ميجابايت" }, { status: 400 });
    }

    // Delete old logo from R2 if exists
    if (group.logoUrl) {
      const oldKey = group.logoUrl.split("/").slice(-2).join("/");
      await deleteFromR2(oldKey).catch(() => {});
    }

    const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
    const key = `groups/${groupId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(key, buffer, file.type);

    const updated = await prisma.group.update({
      where: { id: groupId },
      data: { logoUrl: publicUrl },
      select: { id: true, logoUrl: true },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في رفع الشعار";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(_request);
  if (session instanceof NextResponse) return session;
  if (!session.isSuperAdmin) {
    return NextResponse.json({ success: false, error: "غير مصرح" }, { status: 403 });
  }

  try {
    const { groupId } = await params;
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { logoUrl: true },
    });
    if (!group) {
      return NextResponse.json({ success: false, error: "المجموعة غير موجودة" }, { status: 404 });
    }

    if (group.logoUrl) {
      const key = group.logoUrl.split("/").slice(-2).join("/");
      await deleteFromR2(key).catch(() => {});
    }

    await prisma.group.update({
      where: { id: groupId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الشعار";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
