import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Building2 } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';
import { getLocale, pickLocalized, translate } from '@/lib/i18n';

export default async function DriverProfilePage() {
  const session = await getSession();
  const locale = await getLocale();
  const t = (path: string) => translate(locale, path);

  if (!session?.employeeId) {
    return <div>{t('driver.error.profileLoadFailed')}</div>;
  }

  const employee = await prisma.employee.findUnique({
    where: { id: session.employeeId },
    include: {
      company: true,
      branch: true,
    },
  });

  if (!employee) {
    return <div>{t('driver.error.employeeNotFound')}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('driver.myAccount')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('driver.personalInfo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">{t('driver.name')}</div>
            <div className="font-medium">{pickLocalized(locale, employee)}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">{t('driver.employeeNumber')}</div>
            <div className="font-medium">{employee.employeeNumber || '-'}</div>
          </div>

          <div>
            <div className="text-sm text-gray-500">{t('driver.accountType')}</div>
            <div className="font-medium">
              {session.accountType === 'DRIVER' ? t('driver.driver') : t('driver.carWashWorker')}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {t('driver.company')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">{t('driver.companyName')}</div>
            <div className="font-medium">{pickLocalized(locale, employee.company)}</div>
          </div>

          {employee.branch && (
            <div>
              <div className="text-sm text-gray-500">{t('driver.branch')}</div>
              <div className="font-medium">{pickLocalized(locale, employee.branch)}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t('driver.account')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm text-gray-500">{t('driver.email')}</div>
            <div className="font-medium">{session.email}</div>
          </div>
        </CardContent>
      </Card>

      <LogoutButton />
    </div>
  );
}
