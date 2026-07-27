import { getSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { DriverBottomNav } from '@/components/driver/bottom-nav';
import { DriverPortalHeader } from '@/components/driver/portal-header';
import { DriverTrackingProvider } from '@/components/driver/tracking-provider';

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.accountType !== 'DRIVER') {
    redirect('/dashboard');
  }

  return (
    <DriverTrackingProvider><div className="min-h-screen bg-gray-50 pb-16">
      <main className="container mx-auto p-4 max-w-2xl">
        <DriverPortalHeader />
        {children}
      </main>
      <DriverBottomNav />
    </div></DriverTrackingProvider>
  );
}
