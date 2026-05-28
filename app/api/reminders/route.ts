import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().optional(),
  dueAt: z.string().transform((v) => new Date(v)),
  reminderMinutes: z.number().int().min(0).max(10080).default(15),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  const showCompleted = searchParams.get("showCompleted") === "true";

  const reminders = await prisma.reminder.findMany({
    where: {
      userId: session.id,
      ...(showCompleted ? {} : { isCompleted: false }),
    },
    orderBy: { dueAt: "asc" },
  });

  return NextResponse.json({ success: true, data: reminders });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    }

    const reminder = await prisma.reminder.create({
      data: { ...parsed.data, userId: session.id },
    });

    return NextResponse.json({ success: true, data: reminder }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "فشل في إنشاء التذكير";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
