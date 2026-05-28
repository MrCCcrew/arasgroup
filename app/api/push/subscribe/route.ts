import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRequestSession } from "@/lib/auth/access";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
});

export async function GET(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  return NextResponse.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
}

export async function POST(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json({ success: false, error: "بيانات الاشتراك غير صحيحة" }, { status: 400 });
    const { endpoint, p256dh, auth } = parsed.data;
    // Delete any existing subscription with the same endpoint for this user
    await prisma.pushSubscription.deleteMany({ where: { userId: session.id, endpoint } });
    await prisma.pushSubscription.create({ data: { userId: session.id, endpoint, p256dh, auth } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "فشل" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await requireRequestSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const { endpoint } = await request.json();
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { userId: session.id, endpoint } });
    } else {
      await prisma.pushSubscription.deleteMany({ where: { userId: session.id } });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "فشل" }, { status: 500 });
  }
}
