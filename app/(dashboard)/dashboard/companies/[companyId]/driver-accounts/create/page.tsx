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
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: preSelectedEmployeeId || '',
    email: '',
    password: '',
    mustChangePassword: true,
  });

  useEffect(() => {
    if (!companyId) return;
    fetch(`/api/companies/${companyId}/employees?withoutAccounts=true&types=DRIVER,CAR_WASH_WORKER`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEmployees(data.data || []);
        }
      });
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
              <Label htmlFor="employeeId">الموظف *</Label>
              <Select
                value={formData.employeeId}
                onValueChange={(value) => setFormData({ ...formData, employeeId: value })}
                required
              >
                <SelectTrigger id="employeeId">
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nameAr} ({emp.type === 'DRIVER' ? 'سائق' : 'غسيل'})
                      {emp.employeeNumber && ` - ${emp.employeeNumber}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
