import { NextRequest, NextResponse } from "next/server";
import { generateSQLDump } from "@/lib/backup/sql-generator";
import { uploadToR2 } from "@/lib/storage/r2";

/**
 * Cron job للنسخ الاحتياطي اليومي
 * يجب تشغيله يومياً عبر cron على السيرفر
 * مثال: 0 2 * * * curl http://localhost:3000/api/cron/daily-backup
 */
export async function GET(request: NextRequest) {
  try {
    // التحقق من أن الطلب من localhost فقط (للأمان)
    const host = request.headers.get("host");
    if (!host?.startsWith("localhost") && !host?.startsWith("127.0.0.1")) {
      // يمكن إضافة token للتحقق بدلاً من ذلك
      const authHeader = request.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET || "change-this-secret";

      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    console.log("[CRON] Starting daily backup...");

    // توليد SQL dump
    const sqlDump = await generateSQLDump();
    const buffer = Buffer.from(sqlDump, 'utf-8');

    // رفع إلى R2 في مجلد backups/daily
    const now = new Date();
    const dateStr = now.toISOString().substring(0, 10); // YYYY-MM-DD
    const filename = `backups/daily/${dateStr}.sql`;

    const url = await uploadToR2(filename, buffer, 'application/sql');

    const result = {
      success: true,
      message: "Daily backup completed successfully",
      filename,
      url,
      size: buffer.length,
      timestamp: now.toISOString()
    };

    console.log("[CRON] Daily backup completed:", result);

    return NextResponse.json(result);

  } catch (error) {
    console.error("[CRON] Daily backup failed:", error);
    return NextResponse.json(
      {
        error: "Daily backup failed",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
