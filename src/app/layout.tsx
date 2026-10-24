import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import GlobalHeader from "@/components/GlobalHeader";
import "./globals.css";

const vazir = Vazirmatn({
  variable: "--font-vazir",
  subsets: ["latin", "arabic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "نوبینو | نوبت‌دهی هوشمند آرایشگاه",
    template: "%s | نوبینو",
  },
  description:
    "سیستم نوبت‌دهی صوتی آرایشگاه با هوش مصنوعی، پیامک یادآوری، گالری و مدیریت مالی برای هر آرایشگاه.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <I18nProvider>
          <ThemeProvider>
            <GlobalHeader />
            {children}
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
