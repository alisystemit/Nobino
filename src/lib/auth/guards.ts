import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, JwtPayload } from "@/lib/auth/jwt";

export const AUTH_COOKIE = "nobino_token";

/**
 * کاربر جاری را از کوکی خوانده و از دیتابیس بازیابی می‌کند.
 * در Next 16 توابع cookies/headers ناهمگام هستند.
 */
export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return user;
}

/** تنها زمانی که کاربر وارد شده باشد؛ در غیر این صورت null */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    const err = new Error("احراز هویت الزامی است") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return user;
}

/** بررسی نقش (آرایشگر، نماینده، ادمین) */
export async function requireRole(roles: JwtPayload["role"][]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    const err = new Error("دسترسی غیرمجاز") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}
