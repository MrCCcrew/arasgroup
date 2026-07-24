'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Employee {
  id: string;
  nameAr: string;
  nameEn: string | null;
  type: string;
  employeeNumber: string | null;
}

export default function CreateDriverAccountPage(props: {
  params: Promise<{ companyId: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [companyId, setCompanyId] = React.useState<string>('');
  const preSelectedEmployeeId = searchParams.get('employeeId');

  React.useEffect(() => {
    props.params.then(p => setCompanyId(p.companyId));
  }, [props.params]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState('');
  const [companyType, setCompanyType] = useState<'DELIVERY' | 'CAR_WASH' | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: preSelectedEmployeeId || '',
    email: '',
    password: '',
    mustChangePassword: true,
  });

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    setLoadingEmployees(true);
    setEmployeeError('');

    fetch(`/api/companies/${companyId}/employees?availableForDriverAccount=true`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'فشل تحميل السائقين');
        setCompanyType(data.companyType === 'DELIVERY' || data.companyType === 'CAR_WASH' ? data.companyType : null);
        return data.data as Employee[];
      })
      .then((availableEmployees) => {
        setEmployees(availableEmployees);
        setFormData((current) => availableEmployees.some((employee) => employee.id === current.employeeId)
          ? current
          : { ...current, employeeId: '' });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setEmployees([]);
        setEmployeeError(error instanceof Error ? error.message : 'فشل تحميل السائقين');
      })
      .finally(() => setLoadingEmployees(false));

    return () => controller.abort();
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.employeeId || !formData.email || !formData.password) {
      alert('الرجاء إكمال جميع الحقول');
      return;
    }

    if (formData.password.length < 8) {
      alert('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/driver-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          ...formData,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || 'فشل إنشاء الحساب');
        setLoading(false);
        return;
      }

      router.push(`/dashboard/companies/${companyId}/driver-accounts?created=1`);
    } catch (error) {
      console.error(error);
      alert('حدث خطأ');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">إنشاء حساب سائق جديد</h1>
        <p className="text-sm text-gray-500 mt-1">إنشاء حساب دخول لسائق أو عامل غسيل</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">بيانات الموظف</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employeeId">{companyType === 'CAR_WASH' ? 'اختر السائق أو عامل الغسيل' : 'اختر السائق'} *</Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                disabled={loadingEmployees || employees.length === 0}
              >
                <SelectTrigger id="employeeId">
                  <SelectValue placeholder={loadingEmployees ? 'جاري تحميل السائقين...' : 'اختر من قائمة السائقين المتاحين'} />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nameAr} ({emp.type === 'DRIVER' || emp.type === 'DELIVERY_DRIVER' || emp.type === 'CAR_WASH_DRIVER' ? 'سائق' : 'عامل غسيل'})
                      {emp.employeeNumber && ` - ${emp.employeeNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employeeError && <p className="text-sm text-destructive">{employeeError}</p>}
              {!loadingEmployees && !employeeError && employees.length === 0 && (
                <p className="text-sm text-muted-foreground">لا يوجد سائقون متاحون لإنشاء حساب جديد. أضف السائق أولاً في قسم الموظفين/السائقين وتأكد من عدم وجود حساب مرتبط به.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">بيانات الدخول</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني *</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور *</Label>
              <Input
                id="password"
                type="password"
                placeholder="8 أحرف على الأقل"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="mustChange"
                type="checkbox"
                checked={formData.mustChangePassword}
                onChange={(e) => setFormData({ ...formData, mustChangePassword: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="mustChange" className="font-normal cursor-pointer">
                يجب تغيير كلمة المرور عند أول تسجيل دخول
              </Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="flex-1"
          >
            إلغاء
          </Button>

          <Button type="submit" disabled={loading} className="flex-1">
            {loading ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
          </Button>
        </div>
      </form>
    </div>
  );
}
