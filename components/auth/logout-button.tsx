'use client';

import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/components/providers/locale-provider';

export function LogoutButton() {
  const router = useRouter();
  const { t } = useLocale();

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
      {t('driver.signOut')}
    </Button>
  );
}
