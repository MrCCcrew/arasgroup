import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { DriverBottomNav } from '@/components/driver/bottom-nav';

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.accountType !== 'DRIVER' && session.accountType !== 'CAR_WASH_WORKER') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <main className="container mx-auto p-4 max-w-2xl">
        {children}
      </main>
      <DriverBottomNav />
    </div>
  );
}
