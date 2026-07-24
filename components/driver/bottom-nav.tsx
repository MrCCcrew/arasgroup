"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, MapPin, User } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

const navItems = [{ href: "/driver", icon: Home, key: "home" }, { href: "/driver/invoices", icon: FileText, key: "invoices" }, { href: "/driver/tracking", icon: MapPin, key: "tracking" }, { href: "/driver/profile", icon: User, key: "account" }] as const;

export function DriverBottomNav() {
  const pathname = usePathname(); const { t } = useLocale();
  return <nav className="safe-area-inset-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white"><div className="flex justify-around">{navItems.map((item) => { const Icon = item.icon; const active = pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.href} href={item.href} className={cn("flex min-w-[60px] flex-col items-center justify-center px-3 py-2 transition-colors", active ? "text-blue-600" : "text-gray-600 hover:text-gray-900")}><Icon className="mb-1 h-6 w-6" /><span className="text-xs">{t(`driver.${item.key}`)}</span></Link>; })}</div></nav>;
}
