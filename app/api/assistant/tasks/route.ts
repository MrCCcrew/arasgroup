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
    return NextResponse.json({ success: true, data: { tasks, generatedAt: new Date().toISOString() } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("assistant tasks:", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل المهام" }, { status: 500 });
  }
}
