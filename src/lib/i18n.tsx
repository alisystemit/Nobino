"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Lang = "fa" | "en";

const translations: Record<string, { fa: string; en: string }> = {
  "nav.home": { fa: "خانه", en: "Home" },
  "nav.login": { fa: "ورود", en: "Login" },
  "nav.packages": { fa: "پکیج‌ها", en: "Packages" },
  "nav.salons": { fa: "جستجوی آرایشگاه‌ها", en: "Find Salons" },
  "hero.badge": { fa: "هوش مصنوعی صوتی", en: "Voice AI" },
  "hero.title1": { fa: "نوبت‌دهی آرایشگاه", en: "Salon Booking" },
  "hero.title2": { fa: "با صدای فارسی", en: "with Voice" },
  "hero.subtitle": {
    fa: "نوبینو به هر آرایشگاه یک صفحه و ساب‌دامین مجزا می‌دهد؛ مشتری با میکروفون نوبت می‌گیرد، سیستم آن را به متن تبدیل می‌کند و پیامک یادآوری می‌فرستد.",
    en: "Nobino gives each salon its own page and subdomain. Customers book by voice, the system transcribes it, and SMS reminders are sent automatically.",
  },
  "hero.login": { fa: "ورود به پنل", en: "Login to Dashboard" },
  "hero.demo": { fa: "مشاهده سالن نمونه", en: "View Demo Salon" },
  "hero.search": { fa: "جستجوی آرایشگاه‌ها", en: "Search Salons" },
  "home.features": { fa: "هر آنچه یک آرایشگاه نیاز دارد", en: "Everything a Salon Needs" },
  "home.featuresSub": { fa: "یک پلتفرم کامل برای مدیریت نوبت، مشتری و امور مالی", en: "A complete platform for appointments, customers & finance" },
  "footer.copyright": { fa: "© ۱۴۰۴ نوبینو — نوبت‌دهی هوشمند آرایشگاه", en: "© 2026 Nobino — Smart Salon Booking" },
  "announcement": { fa: "به نوبینو خوش آمدید 🎉", en: "Welcome to Nobino 🎉" },
};

function translate(lang: Lang, key: string): string {
  const entry = translations[key];
  if (!entry) return key;
  return entry[lang];
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const Ctx = createContext<I18nCtx>({ lang: "fa", setLang: () => {}, t: (k) => k, dir: "rtl" });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fa");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nobino_lang") as Lang | null;
      if (saved === "fa" || saved === "en") setLangState(saved);
    } catch {}
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("nobino_lang", l);
    } catch {}
    document.documentElement.dir = l === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = l;
  };

  useEffect(() => {
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <Ctx.Provider value={{ lang, setLang, t: (k) => translate(lang, k), dir: lang === "fa" ? "rtl" : "ltr" }}>
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  return useContext(Ctx);
}

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "fa" ? "en" : "fa")}
      className="rounded-xl border border-white/30 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/10"
    >
      {lang === "fa" ? "EN" : "فا"}
    </button>
  );
}
