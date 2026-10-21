import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";

const OTP_TTL_MS = 5 * 60 * 1000; // ۵ دقیقه
const MAX_ATTEMPTS = 5;

export async function requestOtp(phone: string) {
  const code = String(Math.floor(10000 + Math.random() * 90000)); // ۴ رقم

  // محدودیت تعداد درخواست (ضد اسپم ساده)
  const recentCount = await prisma.otp.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recentCount >= MAX_ATTEMPTS) {
    throw new Error("تعداد درخواست‌های کد بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.");
  }

  await prisma.otp.create({
    data: { phone, code, purpose: "LOGIN", expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });

  await getSmsProvider().sendOtp(phone, code);
  return { expiresIn: OTP_TTL_MS / 1000 };
}

export async function verifyOtp(phone: string, code: string) {
  const record = await prisma.otp.findFirst({
    where: { phone, purpose: "LOGIN", usedAt: null, code },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    throw new Error("کد واردشده صحیح نیست.");
  }
  if (record.expiresAt < new Date()) {
    throw new Error("کد منقضی شده است. دوباره درخواست دهید.");
  }

  await prisma.otp.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  // پیدا کردن یا ساخت کاربر
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({
      data: { phone, role: "CUSTOMER", verifiedAt: new Date() },
    });
  } else if (!user.verifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { verifiedAt: new Date() } });
  }

  return user;
}
