import { NextResponse } from "next/server";

/**
 * @deprecated هذا الـ endpoint تم تعطيله
 *
 * النسخ الاحتياطي تم نقله إلى خدمة مستقلة على السيرفر:
 * - Script: /opt/arasgroup-backup/backup.sh
 * - يعمل عبر Linux cron يومياً الساعة 3:00 صباحاً
 * - يستخدم mysqldump الحقيقي
 * - يحفظ في: /var/backups/arasgroup/database/
 *
 * لعرض النسخ الاحتياطية، استخدم: /api/admin/backups/list
 */
export async function GET() {
  return NextResponse.json(
    {
      error: "Gone",
      message:
        "تم نقل النسخ الاحتياطي إلى خدمة السيرفر المستقلة. لعرض النسخ المتاحة، انتقل إلى إعدادات النظام.",
      deprecatedAt: "2026-07-22",
      newEndpoint: "/api/admin/backups/list",
    },
    { status: 410 }
  );
}

export async function POST() {
  return GET();
}
