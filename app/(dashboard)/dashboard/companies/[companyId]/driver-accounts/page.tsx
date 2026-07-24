import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@/lib/rbac/rbac';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export default async function DriverAccountsPage({
  params,
}: {
  params: { companyId: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { companyId } = params;

  const canView = await hasPermission(session, 'EMPLOYEES', 'VIEW', companyId);
  if (!canView) {
    return <div className="p-6">غير مصرح لك بعرض الموظفين</div>;
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    return <div className="p-6">الشركة غير موجودة</div>;
  }

  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [
        { type: 'DRIVER' },
        { type: 'CAR_WASH_WORKER' },
      ],
    },
    include: {
      user: true,
      driver: true,
      carWashWorker: true,
    },
    orderBy: { fullNameAr: 'asc' },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">حسابات السائقين</h1>
          <p className="text-sm text-gray-500 mt-1">{company.nameAr}</p>
        </div>
        <Link href={`/dashboard/companies/${companyId}/driver-accounts/create`}>
          <Button>
            <Plus className="w-4 h-4 ml-2" />
            إنشاء حساب سائق
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {employees.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-gray-500">
              لا يوجد سائقين
            </CardContent>
          </Card>
        ) : (
          employees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{employee.fullNameAr}</CardTitle>
                    <p className="text-sm text-gray-500">
                      {employee.type === 'DRIVER' ? 'سائق' : 'عامل غسيل سيارات'}
                    </p>
                  </div>
                  {employee.user ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      <CheckCircle className="w-3 h-3" />
                      لديه حساب
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                      <XCircle className="w-3 h-3" />
                      بدون حساب
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {employee.employeeNumber && (
                  <div className="text-sm">
                    <span className="text-gray-500">رقم الموظف: </span>
                    <span className="font-medium">{employee.employeeNumber}</span>
                  </div>
                )}

                {employee.user && (
                  <div className="text-sm">
                    <span className="text-gray-500">البريد الإلكتروني: </span>
                    <span className="font-medium">{employee.user.email}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {!employee.user && (
                    <Link
                      href={`/dashboard/companies/${companyId}/driver-accounts/create?employeeId=${employee.id}`}
                    >
                      <Button size="sm" variant="outline">
                        إنشاء حساب
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
