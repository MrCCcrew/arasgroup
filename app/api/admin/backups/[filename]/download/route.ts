import { getSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { resolveBackupPath } from "@/lib/backup/server-backups";
import fs from "fs";
import { Readable } from "stream";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // 1. التحقق من المصادقة
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. التحقق من الصلاحيات
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Super Admin only" },
        { status: 403 }
      );
    }

    // 3. استخراج اسم الملف مع معالجة encoding errors
    let filename: string;
    try {
      const resolvedParams = await params;
      filename = decodeURIComponent(resolvedParams.filename);
    } catch (error) {
      return NextResponse.json(
        { error: "Malformed filename" },
        { status: 400 }
      );
    }

    // 4. التحقق من صحة اسم الملف وحماية من path traversal
    let fullPath: string;
    try {
      fullPath = resolveBackupPath(filename);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid backup file" },
        { status: 400 }
      );
    }

    // 5. التحقق مرة أخرى من أن الملف موجود وليس symlink
    let stats: fs.Stats;
    try {
      const lstats = fs.lstatSync(fullPath);

      if (lstats.isSymbolicLink()) {
        return NextResponse.json(
          { error: "Symlink not allowed" },
          { status: 400 }
        );
      }

      if (!lstats.isFile()) {
        return NextResponse.json(
          { error: "Not a regular file" },
          { status: 400 }
        );
      }

      stats = lstats;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return NextResponse.json(
          { error: "Backup file not found" },
          { status: 404 }
        );
      }
      // أخطاء أخرى مثل EACCES
      return NextResponse.json(
        { error: "Cannot access backup file" },
        { status: 500 }
      );
    }

    // 6. إنشاء stream للقراءة (لا نحمل الملف كاملاً في الذاكرة)
    const fileStream = fs.createReadStream(fullPath);

    // معالجة أخطاء Stream
    fileStream.on("error", (streamError) => {
      console.error("Stream error:", streamError);
      fileStream.destroy();
    });

    // 7. تحويل Node stream إلى Web ReadableStream
    const webStream = Readable.toWeb(fileStream) as ReadableStream;

    // 8. تنظيف filename للـ header (منع header injection)
    const safeFilename = filename.replace(/["\r\n]/g, "");

    // 9. إرجاع الملف مع headers آمنة
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Error downloading backup:", error);
    // لا نعرض stack trace للمستخدم
    return NextResponse.json(
      { error: "Failed to download backup" },
      { status: 500 }
    );
  }
}
