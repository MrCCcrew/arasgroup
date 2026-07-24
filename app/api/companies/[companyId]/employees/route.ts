import { NextRequest, NextResponse } from 'next/server';
import { EmployeeType, Prisma } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/auth/permissions';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ companyId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
  }

  const { companyId } = await props.params;
  const { searchParams } = new URL(request.url);
  const withoutAccounts = searchParams.get('withoutAccounts') === 'true';
  const typesParam = searchParams.get('types');
  const availableForDriverAccount = searchParams.get('availableForDriverAccount') === 'true';

  const canView = await hasPermission(session, 'EMPLOYEES', 'VIEW', { companyId });
  if (!canView) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
  }

  try {
    let driverAccountCompanyType: 'DELIVERY' | 'CAR_WASH' | undefined;
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (availableForDriverAccount) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { type: true },
      });

      if (!company || (company.type !== 'DELIVERY' && company.type !== 'CAR_WASH')) {
        return NextResponse.json({ error: 'هذه الشركة لا تدعم حسابات السائقين' }, { status: 400 });
      }
      driverAccountCompanyType = company.type;

      const eligibleTypes: EmployeeType[] = company.type === 'DELIVERY'
        ? ['DRIVER', 'DELIVERY_DRIVER']
        : ['CAR_WASH_DRIVER', 'CAR_WASH_WORKER'];

      where.isActive = true;
      where.isDeleted = false;
      where.user = { is: null };
      where.type = { in: eligibleTypes };
    } else {
      if (withoutAccounts) {
        where.user = { is: null };
      }

      if (typesParam) {
        where.type = { in: typesParam.split(',') as EmployeeType[] };
      }
    }

    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        type: true,
        employeeNumber: true,
      },
      orderBy: { nameAr: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: employees,
      ...(availableForDriverAccount ? { companyType: driverAccountCompanyType } : {}),
    });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'فشل جلب الموظفين' }, { status: 500 });
  }
}
