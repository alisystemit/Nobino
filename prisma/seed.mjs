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

  for (let d = 0; d < 7; d++) {
    await prisma.openingHour.upsert({
      where: { salonId_dayOfWeek: { salonId: salon.id, dayOfWeek: d } },
      update: {},
      create: { salonId: salon.id, dayOfWeek: d, openTime: "09:00", closeTime: "21:00" },
    });
  }

  const gallery = [
    { title: "استایل مو", imageUrl: "/gallery/hair.jpg" },
    { title: "میکاپ عروس", imageUrl: "/gallery/makeup.jpg" },
    { title: "ناخن", imageUrl: "/gallery/nails.jpg" },
  ];
  for (const [i, g] of gallery.entries()) {
    await prisma.galleryItem.upsert({
      where: { id: `${salon.id}-${i}` },
      update: {},
      create: { id: `${salon.id}-${i}`, salonId: salon.id, ...g, sortOrder: i },
    });
  }

  const packages = [
    { id: "pkg-0", name: "پکیج پایه", durationDays: 90, price: 990000, features: ["۱ سالن", "نوبت صوتی", "۱۰ پیامک/ماه"] },
    { id: "pkg-1", name: "پکیج حرفه‌ای", durationDays: 180, price: 1890000, features: ["۱ سالن", "نوبت صوتی", "پیامک نامحدود", "گالری نامحدود"] },
    { id: "pkg-2", name: "پکیج طلایی", durationDays: 365, price: 3290000, features: ["۱ سالن", "نوبت صوتی", "پیامک نامحدود", "گالری + ویدیو", "پشتیبانی اختصاصی"] },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { id: p.id },
      update: {},
      create: { id: p.id, name: p.name, durationDays: p.durationDays, price: p.price, features: p.features },
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
