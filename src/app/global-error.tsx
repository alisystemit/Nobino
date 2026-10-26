"use client";

/**
 * خطای سراسری — جای root layout هنگام خطای بحرانی.
 * باید خودش <html> و <body> را رندر کند و به providerهای برنامه (i18n/theme)
 * وابسته نباشد، چون آن‌ها در این مسیر در دسترس نیستند.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const isDev = process.env.NODE_ENV === "development";
  const message =
    isDev && error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : null;
  const digest =
    isDev && error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: unknown }).digest)
      : null;

  // در global-error نمی‌توان از next/link یا useRouter استفاده کرد، چون router و
  // providerهای برنامه در این مسیر در دسترس نیستند؛ تنها راه بی‌خطر، تغییر
  // مستقیم آدرس است.
  const goHome = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#171717",
          fontFamily: "Vazirmatn, Tahoma, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "12px 0 0" }}>مشکلی پیش آمد</h1>
          <p style={{ fontSize: 14, lineHeight: 1.9, color: "#525252", margin: "12px 0 0" }}>
            نمایش این صفحه ممکن نشد. چند لحظه دیگر دوباره تلاش کنید یا به صفحه اصلی برگردید.
          </p>
          {message && (
            <pre
              dir="ltr"
              style={{
                marginTop: 16,
                padding: 12,
                fontSize: 12,
                textAlign: "left",
                background: "#f5f5f5",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {message}
              {digest ? `\n${digest}` : ""}
            </pre>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                background: "#db2777",
                border: 0,
                borderRadius: 12,
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              تلاش دوباره
            </button>
            <button
              type="button"
              onClick={goHome}
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#404040",
                background: "#f5f5f5",
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: "10px 20px",
                cursor: "pointer",
              }}
            >
              صفحه اصلی
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
