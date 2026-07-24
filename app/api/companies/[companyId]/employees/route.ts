import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/rbac/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: { companyId: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { companyId } = params;
  const { searchParams } = new URL(request.url);
  const withoutAccounts = searchParams.get('withoutAccounts') === 'true';
  const typesParam = searchParams.get('types');

  const canView = await hasPermission(session, 'EMPLOYEES', 'VIEW', companyId);
  if (!canView) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (withoutAccounts) {
      where.user = null;
    }

    if (typesParam) {
      const types = typesParam.split(',');
      where.type = { in: types };
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        fullNameAr: true,
        fullNameEn: true,
        type: true,
        employeeNumber: true,
      },
      orderBy: { fullNameAr: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'فشل جلب الموظفين' }, { status: 500 });
  }
}
