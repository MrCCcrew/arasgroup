'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/driver', icon: Home, label: 'الرئيسية' },
  { href: '/driver/invoices', icon: FileText, label: 'الفواتير' },
  { href: '/driver/tracking', icon: MapPin, label: 'التتبع' },
  { href: '/driver/profile', icon: User, label: 'الحساب' },
];

export function DriverBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-inset-bottom z-50">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-3 min-w-[60px] transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
