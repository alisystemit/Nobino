import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy (جایگزین middleware در Next 16).
 * ۱) مسیریابی ساب‌دامین سالن‌ها: «salon.nobino.ir» → «/s/salon»
 * ۲) اجباری کردن زبان فارسی/جهت RTL.
 *
 * توجه: proxy فقط برای تغییر مسیر/بازنویسی استفاده می‌شود، نه تولید پاسخ.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

export function proxy(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  // ساب‌دامین سالن
  if (ROOT_DOMAIN !== "localhost" && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, "");
    if (subdomain && subdomain !== "www" && !pathname.startsWith("/s/")) {
      return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
