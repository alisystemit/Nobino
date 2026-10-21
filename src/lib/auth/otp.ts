import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";
import { getEmailSender } from "@/lib/email/provider";

const OTP_TTL_MS = 5 * 60 * 1000; // ۵ دقیقه
const MAX_ATTEMPTS = 5;

/** ارسال کد تأیید از طریق ایمیل (برای ورود با ایمیل) */
export async function requestEmailOtp(email: string) {
  const code = String(Math.floor(1000 + Math.random() * 9000));

  const recent = await prisma.otp.count({
    where: { phone: email, purpose: "EMAIL_LOGIN", createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 5) throw new Error("تعداد درخواست‌ها بیش از حد مجاز است");

  await prisma.otp.create({
    data: { phone: email, code, purpose: "EMAIL_LOGIN", expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  });

  const sender = await getEmailSender();
  await sender.sendEmail(email, "کد ورود به نوبینو", `کد تأیید شما: <b>${code}</b>`);
  return { expiresIn: 300 };
}

export async function requestOtp(phone: string) {
  const code = String(Math.floor(1000 + Math.random() * 9000)); // ۴ رقم

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

  await (await getSmsProvider()).sendOtp(phone, code);
  return { expiresIn: OTP_TTL_MS / 1000 };
}

export async function verifyOtp(phone: string, code: string, purpose = "LOGIN") {
  const record = await prisma.otp.findFirst({
    where: { phone, purpose, usedAt: null, code },
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
  let user = purpose === "EMAIL_LOGIN" ? await prisma.user.findUnique({ where: { email: phone } }) : await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    if (purpose === "EMAIL_LOGIN") {
      user = await prisma.user.create({
        data: { email: phone, phone: `EMAIL-${Math.random().toString(36).slice(2, 10)}`, role: "CUSTOMER", verifiedAt: new Date() },
      });
    } else {
      user = await prisma.user.create({ data: { phone, role: "CUSTOMER", verifiedAt: new Date() } });
    }
  } else if (!user.verifiedAt) {
    user = await prisma.user.update({ where: { id: user.id }, data: { verifiedAt: new Date() } });
  }

  return user;
}
