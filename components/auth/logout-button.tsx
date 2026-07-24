'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <Button
      variant="destructive"
      className="w-full h-12"
      onClick={handleLogout}
    >
      <LogOut className="w-5 h-5 ml-2" />
      تسجيل الخروج
    </Button>
  );
}
