// ریست رمز عبور ادمین (بدون نیاز به ورود) — مخصوص توسعه/پشتیبانی
// اجرا:  node scripts/reset-admin-password.mjs <رمز-جدید>
// اگر آرگومان ندهی، رمز پیش‌فرض تنظیم می‌شود.

import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${buf.toString("hex")}`;
}

const given = process.argv[2];
const defaultPass = "Admin@1234";
const password = given || defaultPass;

const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
if (!admin) {
  console.error("❌ ادمینی یافت نشد. ابتدا seed را اجرا کنید.");
  process.exit(1);
}

await prisma.user.update({
  where: { id: admin.id },
  data: { passwordHash: await hashPassword(password) },
});

// پاک‌سازی قفل/تلاش‌های ناموفق قبلی
await prisma.otp.updateMany({
  where: { purpose: "PASSWORD_FAIL", usedAt: null },
  data: { usedAt: new Date() },
});

console.log("✅ رمز ادمین بازنشانی شد:");
console.log("   شماره:", admin.phone);
console.log("   رمز  :", password);
console.log("   (ورود از: /login با این شماره و رمز)");

await prisma.$disconnect();
