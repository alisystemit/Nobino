"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * صفحهٔ خطای سراسری مسیرها — به‌جای متن بی‌فایق، خودش وضعیت دیتابیس را
 * از /api/health می‌خواند و راهنمای رفعِ دقیق (همان چیزی که PaaS لازم دارد)
 * را نشان می‌دهد. هیچ دادهٔ حساسی نمایش داده نمی‌شود؛ فقط reason/hint.
 */
type Health = {
  ok?: boolean;
  db?: string;
  schema?: string;
  reason?: string;
  hint?: string;
};

export default function RouteError({ reset }: { error: unknown; reset: () => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setHealth(await res.json());
    } catch {
      setHealth({ ok: false, db: "unknown", hint: "خودِ سرویس هم در دسترس نیست؛ چند لحظه دیگر دوباره تلاش کنید." });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const statusText = health?.ok
    ? "دیتابیس متصل است؛ خطای فعلی احتمالاً موقتی است."
    : health?.db === "up"
      ? "اتصال دیتابیس برقرار است اما مشکل از جدول‌هاست."
      : health?.db === "down"
        ? "سایت به دیتابیس وصل نمی‌شود."
        : checking
          ? "در حال بررسی وضعیت…"
          : "وضعیت نامشخص.";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-5xl">{health?.ok ? "🔄" : "🗄️"}</div>
      <h1 className="mt-4 text-2xl font-black">این صفحه فعلاً نمایش داده نمی‌شود</h1>
      <p className="mt-3 leading-8 text-neutral-600 dark:text-neutral-300">
        {statusText}
      </p>

      {health?.hint && (
        <div className="mt-4 w-full rounded-2xl border border-amber-300 bg-amber-50 p-4 text-right text-sm leading-7 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          {health.hint}
        </div>
      )}

      <details className="mt-4 w-full rounded-2xl border border-neutral-200 bg-white p-4 text-right text-xs leading-6 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <summary className="cursor-pointer font-bold">راهنمای رفع روی PaaS</summary>
        <ol className="mt-3 list-inside list-decimal space-y-2">
          <li>
            در پنل PaaS، بخش <b>Environment Variables</b> مقدار <code dir="ltr">DATABASE_URL</code> را
            بررسی کنید؛ فرمت درست:{" "}
            <code dir="ltr" className="break-all">
              postgresql://USER:PASS@HOST:5432/DB?schema=public
            </code>
          </li>
          <li>
            اگر سرویس PostgreSQL در پنل نساخته‌اید، اول آن را بسازید و رشتهٔ اتصال داخلی را
            به همین نام متغیر بدهید.
          </li>
          <li>
            Start command سرویس باید <code dir="ltr">npm run start:paas</code> باشد تا جدول‌ها
            خودکار ساخته شوند.
          </li>
          <li>سرویس را Restart کنید و این صفحه را تازه کنید.</li>
        </ol>
      </details>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            void check();
            reset();
          }}
          className="rounded-xl bg-pink-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-700"
        >
          تلاش دوباره
        </button>
        <a
          href="/"
          className="rounded-xl border border-neutral-300 bg-white px-5 py-2.5 text-sm font-bold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          صفحه اصلی
        </a>
        <a
          href="/api/health"
          target="_blank"
          rel="noreferrer"
          className="rounded-xl px-3 py-2.5 text-sm font-bold text-neutral-500 underline underline-offset-4 dark:text-neutral-400"
        >
          نتیجهٔ تست سلامت
        </a>
      </div>
    </main>
  );
}
