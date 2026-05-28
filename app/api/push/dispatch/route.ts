import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendPush } from "@/lib/push";

// Called by cron every minute: GET /api/push/dispatch
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const now = new Date();

  // Find reminders that are due within reminderMinutes and not yet notified
  const reminders = await prisma.reminder.findMany({
    where: {
      isCompleted: false,
      notifiedAt: null,
      dueAt: { lte: new Date(now.getTime() + 60 * 60 * 1000) }, // up to 1 hour ahead
    },
    include: { user: { select: { id: true, nameAr: true } } },
  });

  const toNotify = reminders.filter((r) => {
    const notifyAt = new Date(r.dueAt.getTime() - r.reminderMinutes * 60 * 1000);
    return notifyAt <= now;
  });

  let sent = 0;
  const staleIds: string[] = [];

  for (const reminder of toNotify) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: reminder.userId },
    });

    const minutesLeft = Math.round((reminder.dueAt.getTime() - now.getTime()) / 60000);
    const timeLabel =
      minutesLeft <= 0 ? "الآن" : minutesLeft === 1 ? "خلال دقيقة" : `خلال ${minutesLeft} دقيقة`;

    for (const sub of subscriptions) {
      const result = await sendPush(sub, {
        title: `⏰ ${reminder.title}`,
        body: `${timeLabel}${reminder.notes ? ` — ${reminder.notes}` : ""}`,
        tag: `reminder-${reminder.id}`,
        url: "/dashboard/reminders",
      });
      if (result === "gone") staleIds.push(sub.id);
      else sent++;
    }

    await prisma.reminder.update({ where: { id: reminder.id }, data: { notifiedAt: now } });
  }

  if (staleIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
  }

  return NextResponse.json({ success: true, sent, cleaned: staleIds.length });
}
