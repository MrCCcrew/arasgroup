import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  try {
    const { companyId, employeeId, email, password, mustChangePassword } = await request.json();

    if (!companyId || !employeeId || !email || !password) {
      return NextResponse.json({ error: 'بيانات غير كاملة' }, { status: 400 });
    }

    const canCreate = await hasPermission(session, 'EMPLOYEES', 'CREATE', { companyId });
    if (!canCreate) {
      return NextResponse.json({ error: 'غير مصرح بإنشاء حسابات' }, { status: 403 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });

    if (!employee) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    if (employee.companyId !== companyId) {
      return NextResponse.json({ error: 'الموظف ليس في هذه الشركة' }, { status: 400 });
    }

    if (employee.user) {
      return NextResponse.json({ error: 'الموظف لديه حساب بالفعل' }, { status: 400 });
    }

    if (employee.type !== 'DRIVER' && employee.type !== 'CAR_WASH_WORKER') {
      return NextResponse.json({ error: 'الموظف ليس سائقاً أو عامل غسيل' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'البريد الإلكتروني مستخدم بالفعل' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        nameAr: employee.nameAr,
        nameEn: employee.nameEn,
        isActive: true,
        isSuperAdmin: false,
        employeeId: employee.id,
        accountType: employee.type === 'DRIVER' ? 'DRIVER' : 'CAR_WASH_WORKER',
        mustChangePassword: mustChangePassword ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: 'CREATE',
        module: 'DRIVER_ACCOUNTS',
        resourceId: user.id,
        resourceType: 'User',
        companyId,
        newValues: { email, employeeId, accountType: user.accountType },
      },
    });

    return NextResponse.json({
      success: true,
      data: { id: user.id, email: user.email },
    }, { status: 201 });
  } catch (error) {
    console.error('Create driver account error:', error);
    return NextResponse.json({ error: 'فشل إنشاء الحساب' }, { status: 500 });
  }
}
