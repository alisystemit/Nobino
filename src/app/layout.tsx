import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import GlobalHeader from "@/components/GlobalHeader";
import PwaInstall from "@/components/PwaInstall";
import "./globals.css";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["latin", "arabic"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nobino.ir"),
  title: {
    default: "نوبینو | نوبت‌دهی هوشمند آرایشگاه",
    template: "%s | نوبینو",
  },
  description:
    "سیستم نوبت‌دهی صوتی آرایشگاه با هوش مصنوعی، پیامک یادآوری، گالری و مدیریت مالی برای هر آرایشگاه.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "نوبینو" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "نوبینو",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <I18nProvider>
          <ThemeProvider>
            <GlobalHeader />
            {children}
            <PwaInstall />
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
