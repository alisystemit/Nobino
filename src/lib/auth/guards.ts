import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, JwtPayload } from "@/lib/auth/jwt";

export const AUTH_COOKIE = "nobino_token";

/**
 * دریافت کاربر جاری با بررسی نشست فعال. اگر نشست منقضی/ابطال شده باشد،
 * توکن معتبر هم پذیرفته نمی‌شود.
 */
export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const session = await prisma.session.findFirst({
    where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, tokenHash: true },
  });
  if (session) {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(token).digest("hex");
    if (session.tokenHash !== hash) return null;
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return user;
}

/** یاریاب داخلی: تبدیل خطا با وضعیت */
function httpError(message: string, status: number) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

/** نیازمند ورود موفق؛ در غیر این صورت null */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw httpError("Authentication required", 401);
  return user;
}

/** یاریاب دسترسی بر اساس نقش */
export async function requireRole(roles: JwtPayload["role"][]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) throw httpError("Forbidden", 403);
  return user;
}

/**
 * بررسی دسترسی مدیریتی به یک سالن: مالک سالن یا ADMIN کل پلتفرم.
 * جلوگیری از دسترسی متقاطع بین سالن‌های مختلف (tenant isolation).
 */
export async function requireSalonManage(salonId: string) {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findUnique({ where: { id: salonId }, select: { id: true, ownerId: true } });
  if (!salon) throw httpError("Salon not found", 404);
  if (user.role !== "ADMIN" && salon.ownerId !== user.id) throw httpError("Forbidden for this salon", 403);
  return user;
}
