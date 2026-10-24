import * as Sentry from "@sentry/nextjs";

/**
 * پایش خطا/عملکرد در مرورگر (فقط اگر NEXT_PUBLIC_SENTRY_DSN تنظیم شده باشد).
 */
try {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    });
  }
} catch {
  // ignore
}

export function onRouterTransitionStart(url: string) {
  try {
    Sentry.addBreadcrumb({ message: "navigate", category: "navigation", data: { url } });
  } catch {
    // ignore
  }
}