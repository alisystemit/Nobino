import { z } from "zod";
import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE } from "@/lib/auth/guards";
import {
  verifyPassword,
  assertLoginAllowed,
  recordFailedLogin,
  clearFailedLogins,
} from "@/lib/auth/password";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  login: z.string().min(5, "ایمیل یا شماره موبایل را وارد کنید"),
  password: z.string().min(1, "رمز عبور را وارد کنید"),
});

/**
 * ورود با رمز عبور (ایمیل یا شماره موبایل + رمز).
 * برای هر کاربری که رمز عبور تنظیم کرده باشد کار می‌کند؛
 * ورود ادمین پس از تنظیم رمز از همین مسیر انجام می‌شود.
 */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const login = body.login.trim().toLowerCase();

    await assertLoginAllowed(login);

    const isEmail = login.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: login } : { phone: login.startsWith("0") ? login : `0${login}` },
    });

    if (!user || !user.passwordHash) {
      await recordFailedLogin(login);
      return json(
        { success: false, error: "ایمیل/شماره یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      await recordFailedLogin(login);
      return json(
        { success: false, error: "ایمیل/شماره یا رمز عبور اشتباه است." },
        { status: 401 }
      );
    }

    await clearFailedLogins(login);

    const token = await signToken({ sub: user.id, phone: user.phone, role: user.role });

    try {
      const hdrs = await headers();
      const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
      const device = hdrs.get("user-agent") || null;
      await prisma.session.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          device,
          ip,
        },
      });
    } catch {
      // ثبت نشست اختیاری است
    }

    const store = await cookies();
    store.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return json({
      success: true,
      user: { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return apiError(err);
  }
}
