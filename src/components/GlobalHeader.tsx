"use client";

import Link from "next/link";
import { LangSwitch, useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

/** نوار بالای سراسری: برند + کلید زبان */
export default function GlobalHeader() {
  const { t } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-6 dark:border-neutral-800 dark:bg-neutral-900">
      <Link href="/" className="text-lg font-black text-pink-600">
        نوبینو
      </Link>
      <nav className="flex items-center gap-2 text-sm font-medium text-neutral-600">
        <Link href="/salons" className="hover:text-pink-600">{t("nav.salons")}</Link>
        <Link href="/packages" className="hover:text-pink-600">{t("nav.packages")}</Link>
        <Link href="/login" className="rounded-lg bg-pink-600 px-3 py-1.5 text-white hover:bg-pink-700">
          {t("nav.login")}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={t("theme.toggle")}
          title={t("theme.toggle")}
          className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          {dark ? "☀" : "☾"}
        </button>
        <LangSwitch />
      </nav>
    </header>
  );
}
