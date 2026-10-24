// Seed قابل اجرا بدون وابستگی (JavaScript خالص)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: "09120000000" },
    update: {},
    create: { phone: "09120000000", name: "مدیر کل", role: "ADMIN", verifiedAt: new Date() },
  });

  const owner = await prisma.user.upsert({
    where: { phone: "09120000001" },
    update: {},
    create: { phone: "09120000001", name: "نگار رضایی", role: "SALON_OWNER", verifiedAt: new Date() },
  });

  const agent = await prisma.user.upsert({
    where: { phone: "09120000002" },
    update: {},
    create: { phone: "09120000002", name: "امیر محمدی", role: "AGENT", verifiedAt: new Date() },
  });

  const salon = await prisma.salon.upsert({
    where: { slug: "mah" },
    update: {},
    create: {
      slug: "mah",
      name: "سالن زیبایی ماه",
      phone: "02188445566",
      city: "تهران",
      address: "تهران، سعادت‌آباد، بلوار دریا",
      description: "سالن زیبایی تخصصی با کادری مجرب در زمینه مو، پوست و ناخن.",
      coverColor: "#ec4899",
      ownerId: owner.id,
      isApproved: true,
      isActive: true,
    },
  });

  const services = [
    { name: "کوتاهی مو", durationMin: 30, price: 250000 },
    { name: "رنگ مو", durationMin: 120, price: 1200000 },
    { name: "کاشت ناخن", durationMin: 90, price: 900000 },
    { name: "میکاپ", durationMin: 60, price: 800000 },
    { name: "پاکسازی پوست", durationMin: 45, price: 600000 },
    { name: "لمینت مژه", durationMin: 40, price: 500000 },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { id: `${salon.id}-${s.name}` },
      update: {},
      create: { id: `${salon.id}-${s.name}`, salonId: salon.id, ...s },
    });
  }

  // شعبه پیش‌فرض
  await prisma.branch.upsert({
    where: { id: `${salon.id}-branch-main` },
    update: {},
    create: { id: `${salon.id}-branch-main`, salonId: salon.id, name: "شعبه اصلی", city: "تهران", address: salon.address },
  });

  for (let d = 0; d < 7; d++) {
    await prisma.openingHour.upsert({
      where: { salonId_dayOfWeek: { salonId: salon.id, dayOfWeek: d } },
      update: {},
      create: { salonId: salon.id, dayOfWeek: d, openTime: "09:00", closeTime: "21:00" },
    });
  }

  const gallery = [
    { title: "استایل مو", imageUrl: "/gallery/hair.svg" },
    { title: "میکاپ عروس", imageUrl: "/gallery/makeup.svg" },
    { title: "ناخن", imageUrl: "/gallery/nails.svg" },
  ];
  for (const [i, g] of gallery.entries()) {
    await prisma.galleryItem.upsert({
      where: { id: `${salon.id}-${i}` },
      update: {},
      create: { id: `${salon.id}-${i}`, salonId: salon.id, ...g, sortOrder: i },
    });
  }

  const packages = [
    { id: "pkg-0", name: "پلن پایه", plan: "BASIC", durationDays: 30, price: 990000, yearlyPrice: 9900000, features: ["۱ سالن", "نوبت صوتی", "۱۰ پیامک/ماه", "۵ کارمند"] },
    { id: "pkg-1", name: "پلن حرفه‌ای", plan: "PRO", durationDays: 30, price: 1890000, yearlyPrice: 18900000, features: ["۱ سالن", "نوبت صوتی", "پیامک نامحدود", "گالری نامحدود", "۲۰ کارمند", "وب‌هوک"] },
    { id: "pkg-2", name: "پلن سازمانی", plan: "ENTERPRISE", durationDays: 30, price: 3290000, yearlyPrice: 32900000, features: ["چند شعبه", "نوبت صوتی", "پیامک نامحدود", "کارکنان نامحدود", "دامنه اختصاصی", "پشتیبانی اختصاصی"] },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { id: p.id },
      update: { plan: p.plan, durationDays: p.durationDays, price: p.price, yearlyPrice: p.yearlyPrice, features: p.features },
      create: { id: p.id, name: p.name, plan: p.plan, durationDays: p.durationDays, price: p.price, yearlyPrice: p.yearlyPrice, features: p.features },
    });
  }

  await prisma.commissionPlan.upsert({
    where: { agentId_salonId: { agentId: agent.id, salonId: salon.id } },
    update: {},
    create: { agentId: agent.id, salonId: salon.id, percent: 20 },
  });

  for (const ownerId of [owner.id, agent.id, admin.id]) {
    await prisma.wallet.upsert({ where: { ownerId }, update: {}, create: { ownerId } });
  }

  // ─── تنظیمات پیش‌فرض سیستم (پویا) ─────────────────────────────────────
  const defaultSettings = [
    { key: "sms.active_provider", value: "kavenegar", group: "sms", type: "select", options: JSON.stringify(["kavenegar", "smsdotir", "farazsms", "ghasedak", "melipayamak", "iransms", "payamresan", "nakalaya", "mobilesms", "arpano"]), description: "سرویس پیامک فعال" },
    { key: "payments.default_gateway", value: "sandbox", group: "payments", type: "select", options: JSON.stringify(["sandbox", "zarinpal", "mellat", "saman", "parsian", "pasargad", "asanpardakht", "irankish", "sadad", "maban", "cetab", "pardakhtnet", "psp", "nextpay", "vanak", "behpardakht", "payir", "zibal", "idpay", "amanat"]), description: "درگاه پرداخت پیش‌فرض" },
    { key: "voice.provider", value: "mock", group: "voice", type: "select", options: JSON.stringify(["mock", "openai"]), description: "موتور تبدیل گفتار به متن" },
    { key: "general.announcement", value: "", group: "general", type: "string", description: "اعلان سراسری (در صفحه اصلی نمایش داده می‌شود)" },
    { key: "sms.template.confirm", value: "نوبت شما در «{salon}» برای ساعت {time} ثبت شد. (تأیید: {code})", group: "sms", type: "string", description: "قالب پیامک تأیید نوبت" },
    { key: "sms.template.reminder", value: "یادآوری: نوبت شما در «{salon}» رأس ساعت {time} است.", group: "sms", type: "string", description: "قالب پیامک یادآوری" },
    { key: "sms.template.cancel", value: "نوبت شما در «{salon}» لغو شد.", group: "sms", type: "string", description: "قالب پیامک لغو نوبت" },
    { key: "email.smtp_host", value: "", group: "email", type: "string", description: "هاست SMTP (ایمیل)" },
    { key: "email.smtp_port", value: "587", group: "email", type: "string", description: "پورت SMTP" },
    { key: "email.smtp_user", value: "", group: "email", type: "string", description: "نام کاربری SMTP" },
    { key: "email.smtp_pass", value: "", group: "email", type: "secret", description: "رمز SMTP" },
    { key: "email.from", value: "noreply@nobino.ir", group: "email", type: "string", description: "آدرس فرستنده ایمیل" },
    { key: "openai.api_key", value: "", group: "ai", type: "secret", description: "کلید OpenAI برای قابلیت‌های هوش مصنوعی" },
    { key: "stt.openai.key", value: "", group: "ai", type: "secret", description: "کلید OpenAI برای Whisper (STT)" },
    { key: "stt.groq.key", value: "", group: "ai", type: "secret", description: "کلید Groq برای Whisper رایگان (STT)" },
    { key: "ai.enabled", value: "true", group: "ai", type: "select", options: JSON.stringify(["true", "false"]), description: "فعال‌سازی قابلیت‌های AI" },
  ];
  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }

  console.log("✅ Seed کامل شد");
  console.log("   ادمین   : 09120000000");
  console.log("   آرایشگر : 09120000001");
  console.log("   نماینده : 09120000002");
  console.log("   سالن    : /s/mah");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
