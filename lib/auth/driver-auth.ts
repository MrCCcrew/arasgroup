// Driver API auth helpers
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/types';

export async function validateDriverSession(session: SessionUser | null) {
  if (!session?.employeeId) {
    return {
      error: NextResponse.json({ error: 'غير مصرح' }, { status: 401 }),
      employee: null,
      user: null,
    };
  }

  if (session.accountType !== 'DRIVER' && session.accountType !== 'CAR_WASH_WORKER') {
    return {
      error: NextResponse.json({ error: 'هذا الحساب غير مصرح' }, { status: 403 }),
      employee: null,
      user: null,
    };
  }

  // Check user is still active
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    return {
      error: NextResponse.json({ error: 'الحساب معطل' }, { status: 403 }),
      employee: null,
      user: null,
    };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: { driver: true, carWashWorker: true },
  });

  if (!employee) {
    return {
      error: NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 }),
      employee: null,
      user: null,
    };
  }

  return { error: null, employee, user };
}
