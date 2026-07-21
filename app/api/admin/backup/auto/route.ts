import { getSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";
import { generateSQLDump } from "@/lib/backup/sql-generator";
import { uploadToR2 } from "@/lib/storage/r2";

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.isSuperAdmin) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    // توليد SQL dump
    const sqlDump = await generateSQLDump();
    const buffer = Buffer.from(sqlDump, 'utf-8');

    // رفع إلى R2
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `backups/auto_${timestamp}.sql`;

    const url = await uploadToR2(filename, buffer, 'application/sql');

    return NextResponse.json({
      success: true,
      message: "تم إنشاء النسخة الاحتياطية ورفعها بنجاح",
      url,
      filename,
      size: buffer.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("خطأ في النسخ الاحتياطي الأوتوماتيكي:", error);
    return NextResponse.json(
      { error: "فشل النسخ الاحتياطي الأوتوماتيكي" },
      { status: 500 }
    );
  }
}
