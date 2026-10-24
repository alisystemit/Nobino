import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * روتینگ پیش از رسیدگی به روت‌ها: ساب‌دامین/دامنه اختصاصی سالن → صفحه اختصاصی سالن
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";

export async function proxy(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;

  // ۱) ساب‌دامین روی دامنه اصلی
  if (ROOT_DOMAIN !== "localhost" && hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, "");
    if (subdomain && subdomain !== "www" && !pathname.startsWith("/s/")) {
      return NextResponse.rewrite(new URL(`/s/${subdomain}${pathname}`, request.url));
    }
  }

  // ۲) دامنهٔ اختصاصی سالن (فقط پس از تأیید)
  if (
    ROOT_DOMAIN !== "localhost" &&
    hostname !== ROOT_DOMAIN &&
    !hostname.endsWith(`.${ROOT_DOMAIN}`) &&
    hostname !== "localhost" &&
    !hostname.startsWith("127.") &&
    !pathname.startsWith("/s/")
  ) {
    const salon = await prisma.salon.findFirst({
      where: { customDomain: hostname, domainStatus: "VERIFIED", isApproved: true, isActive: true },
      select: { slug: true },
    });
    if (salon?.slug) {
      return NextResponse.rewrite(new URL(`/s/${salon.slug}${pathname}`, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};