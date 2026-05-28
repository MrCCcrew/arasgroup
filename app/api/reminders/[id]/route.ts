import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  notes: z.string().optional(),
  dueAt: z.string().transform((v) => new Date(v)).optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
  isCompleted: z.boolean().optional(),
});

interface Props { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  try {
    const existing = await prisma.reminder.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.id)
      return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.isCompleted === true && !existing.isCompleted) data.completedAt = new Date();
    if (parsed.data.isCompleted === false) { data.completedAt = null; data.notifiedAt = null; }
    const updated = await prisma.reminder.update({ where: { id }, data });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Props) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const existing = await prisma.reminder.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.id)
    return NextResponse.json({ success: false, error: "غير موجود" }, { status: 404 });
  await prisma.reminder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
