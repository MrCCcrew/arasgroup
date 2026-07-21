import { NextResponse } from "next/server";

/**
 * @deprecated هذا الـ endpoint تم تعطيله
 *
 * النسخ الاحتياطي تم نقله إلى خدمة مستقلة على السيرفر.
 * لعرض النسخ المتاحة: /api/admin/backups/list
 * لتحميل نسخة: /api/admin/backups/[filename]/download
 */
export async function POST() {
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
