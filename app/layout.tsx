import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { getLocale, getLocaleDirection } from "@/lib/i18n";

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
  icons: {
    icon: "/favicon.ico",
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

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
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
