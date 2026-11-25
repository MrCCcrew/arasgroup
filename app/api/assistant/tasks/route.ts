import { NextRequest, NextResponse } from "next/server";
import { requireRequestSession } from "@/lib/auth/access";
import { getAssistantTasks } from "@/lib/assistant/tasks";

// Read-only: returns the signed-in user's role-based tasks (counts only, no personal data).
export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  if (session.accountType && session.accountType !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
  }

  const companyId = new URL(request.url).searchParams.get("companyId");
  try {
    const tasks = await getAssistantTasks(session, companyId || null);
    const GENERIC = new Set(["مدير", "المدير", "مشرف", "المشرف", "محاسب", "المحاسب", "موظف", "الموظف", "حساب", "admin", "Admin", "System"]);
    const first = (session.nameAr || session.nameEn || "").trim().split(/\s+/)[0] || "";
    const firstName = GENERIC.has(first) ? "" : first;
    return NextResponse.json({ success: true, data: { tasks, firstName, generatedAt: new Date().toISOString() } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("assistant tasks:", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل المهام" }, { status: 500 });
  }
}
