import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Header } from "@/components/layout/header";
import { ReminderManager } from "@/components/reminders/reminder-manager";

export default async function RemindersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const reminders = await prisma.reminder.findMany({
    where: { userId: session.id },
    orderBy: { dueAt: "asc" },
  });

  const serialized = reminders.map((r) => ({
    ...r,
    dueAt: r.dueAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    notifiedAt: r.notifiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div>
      <Header title="التذكيرات" subtitle="سجّل مهامك اليومية واستقبل تنبيهات ويندوز قبل موعدها" />
      <div className="page-container">
        <ReminderManager initialReminders={serialized} userId={session.id} />
      </div>
    </div>
  );
}
