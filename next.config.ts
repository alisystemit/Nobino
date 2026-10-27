import type { NextConfig } from "next";

/**
 * هدرهای امنیتی پایه برای همه پاسخ‌ها.
 * HSTS عمداً تنظیم نشده: این دامنه روی پورت 8443 سرو می‌شود و 443 در اختیار پنل دیگری است؛
 * HSTS مرورگر را به 443 همان دامنه می‌فرستد و دسترسی را خراب می‌کند.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(self), payment=(self)",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
