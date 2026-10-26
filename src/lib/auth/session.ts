import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE } from "@/lib/auth/guards";

/** مدت اعتبار نشست (۷ روز) — در کوکی و رکورد دیتابیس یکسان استفاده می‌شود */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SessionUser = { id: string; phone: string; role: string };

/**
 * صدور نشست مشترک همهٔ مسیرهای ورود (OTP، رمز عبور، ورود سوپرادمین):
 * توکن JWT + رکورد `Session` (هش ۲۵۶ توکن) + کوکی httpOnly.
 *
 * ثبت نشست در دیتابیس اختیاری است؛ اگر شکست بخورد فقط لاگ می‌شود و
 * کوکی همچنان ست می‌شود (رفتار قبلی حفظ شده است).
 */
export async function issueSession(user: SessionUser): Promise<string> {
  const token = await signToken({ sub: user.id, phone: user.phone, role: user.role });

  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const device = hdrs.get("user-agent") || null;
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        device,
        ip,
      },
    });
  } catch (err) {
    console.error("session record failed:", err);
  }

  const store = await cookies();
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  return token;
}

/** نمای کاربر برای پاسخ API — هرگز فیلد محرمانه‌ای (مثل passwordHash) ندارد */
export function publicUser(user: { id: string; phone: string; email: string | null; name: string | null; role: string }) {
  return { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role };
}
