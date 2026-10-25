/**
 * ابزارهای کمکی مشترک
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** ترکیب کلاس‌های tailwind */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

/** پاسخ JSON استاندارد برای Route Handlers */
export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(init?.headers ?? {}) },
  });
}

export function apiError(error: unknown) {
  // خطاهای اعتبارسنجی Zod را به 400 نگاشت می‌کنیم
  let status = (error as { status?: number })?.status ?? 500;
  let message = error instanceof Error ? error.message : "خطای ناشناخته";
  const zod = (error as { name?: string; issues?: unknown }).name;
  if (zod === "ZodError") {
    status = 400;
    try {
      const issues = (error as { issues: { message: string }[] }).issues;
      message = issues.map((i) => i.message).join("؛ ");
    } catch {
      /* ignore */
    }
  }
  // ثبت خطاهای سرور برای پایش (گزارش خطا)
  if (status >= 500) {
    import("@/lib/monitoring").then((m) => m.reportError(error, { status })).catch(() => {});
  }
  return json({ success: false, error: message }, { status });
}

/** تبدیل عدد به فرمت تومان با جداکننده هزارگان */
export function formatToman(amount: number): string {
  return new Intl.NumberFormat("fa-IR").format(amount) + " تومان";
}

/** تبدیل تاریخ به شمسی (فقط نمایش) */
export function toJalali(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function toPersianDigits(input: string | number): string {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/\d/g, (d) => fa[Number(d)]);
}
