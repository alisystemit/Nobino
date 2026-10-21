"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function HomeHero() {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden bg-gradient-to-bl from-pink-500 via-rose-500 to-purple-600 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
      <div className="relative mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {t("hero.badge")}
        </span>
        <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
          {t("hero.title1")}
          <br />
          {t("hero.title2")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-rose-50">{t("hero.subtitle")}</p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/login" className="rounded-xl bg-white px-8 py-3.5 text-base font-bold text-rose-600 shadow-lg transition hover:bg-rose-50">
            {t("hero.login")}
          </Link>
          <a href="/s/mah" className="rounded-xl border border-white/40 px-8 py-3.5 text-base font-bold text-white transition hover:bg-white/10">
            {t("hero.demo")}
          </a>
          <Link href="/salons" className="rounded-xl bg-white/10 px-8 py-3.5 text-base font-bold text-white backdrop-blur transition hover:bg-white/20">
            {t("hero.search")}
          </Link>
        </div>
      </div>
    </section>
  );
}
