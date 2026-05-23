import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadToR2, deleteFromR2 } from "@/lib/storage/r2";
import { requireRequestSession } from "@/lib/auth/access";

interface Props {
  params: Promise<{ companyId: string }>;
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
    const { companyId } = await params;

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, logoUrl: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "الشركة غير موجودة" }, { status: 404 });
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
    if (company.logoUrl) {
      const oldKey = company.logoUrl.split("/").slice(-2).join("/"); // e.g. companies/xxx/logo.png
      await deleteFromR2(oldKey).catch(() => {}); // silently ignore if not found
    }

    const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
    const key = `companies/${companyId}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const publicUrl = await uploadToR2(key, buffer, file.type);

    const updated = await prisma.company.update({
      where: { id: companyId },
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
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { logoUrl: true },
    });
    if (!company) {
      return NextResponse.json({ success: false, error: "الشركة غير موجودة" }, { status: 404 });
    }

    if (company.logoUrl) {
      const key = company.logoUrl.split("/").slice(-2).join("/");
      await deleteFromR2(key).catch(() => {});
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { logoUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في حذف الشعار";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
