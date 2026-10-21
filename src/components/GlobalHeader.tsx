"use client";

import Link from "next/link";
import { LangSwitch, useI18n } from "@/lib/i18n";

/** نوار بالای سراسری: برند + کلید زبان */
export default function GlobalHeader() {
  const { t } = useI18n();
  return (
    <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2.5 sm:px-6">
      <Link href="/" className="text-lg font-black text-pink-600">
        نوبینو
      </Link>
      <nav className="flex items-center gap-2 text-sm font-medium text-neutral-600">
        <Link href="/salons" className="hover:text-pink-600">{t("nav.salons")}</Link>
        <Link href="/packages" className="hover:text-pink-600">{t("nav.packages")}</Link>
        <Link href="/login" className="rounded-lg bg-pink-600 px-3 py-1.5 text-white hover:bg-pink-700">
          {t("nav.login")}
        </Link>
        <LangSwitch />
      </nav>
    </header>
  );
}
