import type { Instrumentation } from "next";

/**
 * Adapter: پایش خطا/عملکرد در سمت سرور.
 * اگر SENTRY_DSN تنظیم شده باشد، Sentry فعال می‌شود.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  try {
    if (!process.env.SENTRY_DSN) {
      console.error("[request-error]", error, { request, context });
      return;
    }
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(error, {
      extra: {
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    });
  } catch {
    // fallback silently
  }
};