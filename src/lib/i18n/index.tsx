"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type Locale = "fa" | "en";

interface I18nContextType {
  locale: Locale;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

const translations: Record<Locale, Record<string, string>> = {
  fa: {
    "app.name": "نوبینو",
    "app.tagline": "نوبت‌دهی هوشمند آرایشگاه",
    "nav.home": "خانه",
    "nav.salons": "آرایشگاه‌ها",
    "nav.login": "ورود",
    "nav.register": "ثبت‌نام",
    "nav.dashboard": "پنل کاربری",
    "nav.logout": "خروج",
  },
  en: {
    "app.name": "Nobino",
    "app.tagline": "Smart Salon Booking",
    "nav.home": "Home",
    "nav.salons": "Salons",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.dashboard": "Dashboard",
    "nav.logout": "Logout",
  },
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale] = useState<Locale>("fa");

  const t = (key: string): string => {
    return translations[locale][key] || key;
  };

  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function LangSwitch() {
  const { locale } = useI18n();

  const toggle = () => {
    // Simple toggle - in production would use router
    window.location.reload();
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
    >
      {locale === "fa" ? "EN" : "فا"}
    </button>
  );
}