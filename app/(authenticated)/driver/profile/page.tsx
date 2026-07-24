import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Building2, LogOut } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

export default async function DriverProfilePage() {
  const session = await getSession();

  if (!session?.employeeId) {
    return <div>خطأ في تحميل البيانات</div>;
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: {
      company: true,
      branch: true,
    },
  });

  if (!employee) {
    return <div>الموظف غير موجود</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">حسابي</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            المعلومات الشخصية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">الاسم</div>
            <div className="font-medium">{employee.nameAr}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">رقم الموظف</div>
            <div className="font-medium">{employee.employeeNumber || '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">الوظيفة</div>
            <div className="font-medium">
              {session.accountType === 'DRIVER' ? 'سائق' : 'عامل غسيل سيارات'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            الشركة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">اسم الشركة</div>
            <div className="font-medium">{employee.company.nameAr}</div>
          </div>

          {employee.branch && (
            <div>
              <div className="text-sm text-gray-500">الفرع</div>
              <div className="font-medium">{employee.branch.nameAr}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-5 h-5" />
            الحساب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">البريد الإلكتروني</div>
            <div className="font-medium">{session.email}</div>
          </div>
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  );
}
