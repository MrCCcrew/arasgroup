import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { getLocale, getLocaleDirection } from "@/lib/i18n";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: {
    template: "%s | نظام مجموعة عبد الفتاح راشد",
    default: "نظام مجموعة عبد الفتاح راشد للإدارة والتحكم",
  },
  description: "نظام رقابي ومحاسبي متكامل لمجموعة عبد الفتاح راشد",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "نظام مجموعة عبد الفتاح راشد",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = getLocaleDirection(locale);

  const group = await prisma.group.findFirst({
    select: { logoUrl: true },
    orderBy: { createdAt: "asc" },
  });
  const faviconUrl = group?.logoUrl ?? "/favicon.svg";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="icon" href={faviconUrl} />
        <link rel="apple-touch-icon" href={faviconUrl} />
        <link
          href="https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        <LocaleProvider initialLocale={locale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
