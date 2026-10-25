/* eslint-disable */
// Seed داده نمونه واقعی — چند سالن، کارکنان با عکس، نوبت‌ها، نظرات و CRM
// اجرا: node scripts/seed-demo.mjs  (Idempotent — با خیال راحت چندبار اجرا کنید)
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "public", "uploads", "seed");

/* ─────────────────────── ابزار تولید تصویر (SVG) ─────────────────────── */
const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

// ── فونت‌های جاسازی‌شده — تا متن داخل SVG در هر محیطی با فونت فارسی دیده شود ──
// (SVG وقتی به‌صورت <img> یا تصویر دیده می‌شود نمی‌تواند فونت بیرونی بار کند؛
//  برای همین فایل فونت را به‌صورت base64 داخل خود SVG قرار می‌دهیم.)
const fontB64 = (name) => {
  try { return readFileSync(path.join(ROOT, "public", "fonts", name)).toString("base64"); }
  catch { return ""; }
};
const _YekanBold = fontB64("Yekan-Bold.woff2");
const _IranSans = fontB64("IRANSans-Regular.woff2");
const SVG_FONTS =
  (_YekanBold || _IranSans)
    ? `<style><![CDATA[` +
      (_YekanBold ? `@font-face{font-family:"Yekan";src:url(data:font/woff2;base64,${_YekanBold}) format("woff2");font-weight:700;}` : "") +
      (_IranSans ? `@font-face{font-family:"IranSans";src:url(data:font/woff2;base64,${_IranSans}) format("woff2");font-weight:400;}` : "") +
      `]]></style>`
    : "";
const F_YEKAN = '"Yekan","Vazirmatn",Tahoma,sans-serif';
const F_IRANSANS = '"IranSans","Vazirmatn",Tahoma,sans-serif';

function svgLogo(letter, c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${SVG_FONTS}<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="256" height="256" rx="64" fill="url(#g)"/><circle cx="64" cy="52" r="30" fill="#fff" opacity="0.18"/><circle cx="204" cy="196" r="44" fill="#fff" opacity="0.10"/><text x="128" y="140" text-anchor="middle" dominant-baseline="central" font-size="112" font-weight="bold" fill="#fff" font-family="${F_YEKAN}">${esc(letter)}</text></svg>`;
}

function svgBanner(name, tagline, c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">${SVG_FONTS}<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1200" height="400" fill="url(#g)"/><circle cx="1030" cy="60" r="130" fill="#fff" opacity="0.10"/><circle cx="150" cy="360" r="100" fill="#fff" opacity="0.10"/><circle cx="1120" cy="330" r="70" fill="#fff" opacity="0.08"/><text x="600" y="170" text-anchor="middle" font-size="68" font-weight="bold" fill="#fff" font-family="${F_YEKAN}">${esc(name)}</text><text x="600" y="245" text-anchor="middle" font-size="32" fill="#ffffffd9" font-family="${F_IRANSANS}">${esc(tagline)}</text></svg>`;
}

function svgGallery(title, label, c1, c2, idx) {
  const x = 400;
  const y = 210 + idx * 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">${SVG_FONTS}<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="640" cy="110" r="90" fill="#fff" opacity="0.12"/><circle cx="160" cy="480" r="70" fill="#fff" opacity="0.12"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="170" font-weight="bold" fill="#ffffff4d" font-family="${F_YEKAN}">${esc(label)}</text><rect x="0" y="470" width="800" height="130" fill="#00000033"/><text x="400" y="540" text-anchor="middle" font-size="42" font-weight="bold" fill="#fff" font-family="${F_YEKAN}">${esc(title)}</text></svg>`;
}

function svgAvatar(initials, c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${SVG_FONTS}<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><circle cx="128" cy="128" r="128" fill="url(#g)"/><text x="128" y="138" text-anchor="middle" dominant-baseline="central" font-size="86" font-weight="bold" fill="#fff" font-family="${F_YEKAN}">${esc(initials)}</text></svg>`;
}

async function writeAsset(file, content) {
  await mkdir(ASSETS, { recursive: true });
  await writeFile(path.join(ASSETS, file), content, "utf8");
}

/* ─────────────────────── داده پایه ─────────────────────── */
const CATALOG = [
  { name: "کوتاهی مو", durationMin: 30, price: 250000 },
  { name: "رنگ مو", durationMin: 120, price: 1200000 },
  { name: "مش و لایت", durationMin: 150, price: 1800000 },
  { name: "کاشت ناخن", durationMin: 90, price: 900000 },
  { name: "میکاپ", durationMin: 60, price: 800000 },
  { name: "میکاپ عروس", durationMin: 120, price: 1500000 },
  { name: "پاکسازی پوست", durationMin: 45, price: 600000 },
  { name: "لمینت مژه", durationMin: 40, price: 500000 },
  { name: "کراتینه مو", durationMin: 180, price: 2200000 },
  { name: "شینیون", durationMin: 60, price: 700000 },
  { name: "اپیلاسیون", durationMin: 30, price: 300000 },
  { name: "پدیکور", durationMin: 45, price: 550000 },
];

const SALONS = [
  {
    slug: "mah", name: "سالن زیبایی ماه", city: "تهران", phone: "02188445566",
    address: "تهران، سعادت‌آباد، بلوار دریا، نبش کوچه بهار، پلاک ۱۲",
    tagline: "زیبایی در تخصص ماست — مو، پوست و ناخن",
    c1: "#ec4899", c2: "#8b5cf6",
    owner: { phone: "09120000001", name: "نگار رضایی" },
    serviceIdx: null, // خدمات واقعی این سالن از قبل موجود است
    staff: [
      { name: "لیلا احمدی", title: "آرایشگر ارشد", specialties: ["رنگ مو", "مش و لایت"], shift: 9 },
      { name: "پریسا شریفی", title: "میکاپ آرتیست", specialties: ["میکاپ عروس", "شینیون"], shift: 11 },
      { name: "نسترن کاظمی", title: "کاشتکار ناخن", specialties: ["کاشت ناخن", "پدیکور"], shift: 13 },
      { name: "مهسا حسینی", title: "کارشناس پوست", specialties: ["پاکسازی پوست"], shift: 10 },
      { name: "سحر محمدی", title: "منشی سالن", role: "RECEPTION", specialties: [], shift: 9 },
    ],
    gallery: null, // گالری از قبل موجود است
    branches: 1,
  },
  {
    slug: "niloofar", name: "سالن زیبایی نیلوفر", city: "اصفهان", phone: "03132223344",
    address: "اصفهان، چهارباغ بالا، مجتمع الماس شرق، طبقه سوم",
    tagline: "جایی که زیبایی شکوفه می‌زند",
    c1: "#8b5cf6", c2: "#6366f1",
    owner: { phone: "09120000011", name: "سارا کریمی" },
    serviceIdx: [0, 1, 2, 4, 6, 7],
    staff: [
      { name: "مریم رستمی", title: "آرایشگر ارشد", specialties: ["رنگ مو", "مش و لایت"], shift: 9 },
      { name: "الناز صالحی", title: "میکاپ آرتیست", specialties: ["میکاپ عروس", "شینیون"], shift: 11 },
      { name: "کیمیا نوری", title: "کاشتکار ناخن", specialties: ["کاشت ناخن"], shift: 13 },
      { name: "ترانه عزیزی", title: "منشی سالن", role: "RECEPTION", specialties: [], shift: 9 },
    ],
    gallery: ["استایل مو", "میکاپ عروس", "طراحی ناخن"],
    branches: 2,
  },
  {
    slug: "rose", name: "سالن زیبایی رز", city: "شیراز", phone: "07132223355",
    address: "شیراز، بلوار چمران، کوچه ۹، ساختمان رز",
    tagline: "شکوفایی زیبایی شما، تعهد ماست",
    c1: "#f43f5e", c2: "#fb7185",
    owner: { phone: "09120000012", name: "مریم موسوی" },
    serviceIdx: [0, 1, 3, 5, 8, 9],
    staff: [
      { name: "شیدا رحیمی", title: "آرایشگر ارشد", specialties: ["کراتینه مو", "رنگ مو"], shift: 9 },
      { name: "غزل کاظمی", title: "میکاپ آرتیست", specialties: ["میکاپ عروس"], shift: 11 },
      { name: "رویا ناظری", title: "کارشناس پوست", specialties: ["پاکسازی پوست"], shift: 10 },
    ],
    gallery: ["استایل مو", "میکاپ عروس", "کراتینه مو"],
    branches: 2,
  },
  {
    slug: "ava", name: "سالن زیبایی آوا", city: "مشهد", phone: "05132221100",
    address: "مشهد، بلوار سجاد، نبش گلستان، پلاک ۸",
    tagline: "آوای زیبایی، همنوای شما",
    c1: "#0ea5e9", c2: "#22d3ee",
    owner: { phone: "09120000013", name: "الناز جعفری" },
    serviceIdx: [0, 2, 3, 4, 6, 10],
    staff: [
      { name: "هستی فرهادی", title: "آرایشگر ارشد", specialties: ["مش و لایت"], shift: 9 },
      { name: "نیلوفر شایان", title: "میکاپ آرتیست", specialties: ["میکاپ"], shift: 11 },
      { name: "آیدا کریمیان", title: "کاشتکار ناخن", specialties: ["کاشت ناخن", "پدیکور"], shift: 13 },
      { name: "پگاه امینی", title: "منشی سالن", role: "RECEPTION", specialties: [], shift: 9 },
    ],
    gallery: ["طراحی ناخن", "استایل مو", "پاکسازی پوست"],
    branches: 1,
  },
  {
    slug: "bahar", name: "سالن زیبایی بهار", city: "کرج", phone: "02632224455",
    address: "کرج، جهانشهر، میدان گلستان، مجتمع بهاران",
    tagline: "بهاری تازه برای زیبایی شما",
    c1: "#22c55e", c2: "#10b981",
    owner: { phone: "09120000014", name: "فاطمه حسینی" },
    serviceIdx: [0, 1, 4, 6, 7, 11],
    staff: [
      { name: "زهرا ملکی", title: "آرایشگر ارشد", specialties: ["رنگ مو"], shift: 9 },
      { name: "سمیرا عابدینی", title: "میکاپ آرتیست", specialties: ["میکاپ عروس", "میکاپ"], shift: 11 },
      { name: "یاسمن راد", title: "کارشناس پوست", specialties: ["پاکسازی پوست", "لمینت مژه"], shift: 10 },
    ],
    gallery: ["استایل مو", "میکاپ", "لمینت مژه"],
    branches: 1,
  },
  {
    slug: "gisso", name: "سالن زیبایی گیسو", city: "تبریز", phone: "04132226677",
    address: "تبریز، ولیعصر، اول فلکه بزرگ، پاساژ گلستان",
    tagline: "هنر دستان ما، زیبایی گیسوی شما",
    c1: "#f59e0b", c2: "#f97316",
    owner: { phone: "09120000015", name: "رها نادری" },
    serviceIdx: [0, 1, 2, 3, 9, 10],
    staff: [
      { name: "آیلین شمس", title: "آرایشگر ارشد", specialties: ["مش و لایت", "رنگ مو"], shift: 9 },
      { name: "مهدیس پناهی", title: "میکاپ آرتیست", specialties: ["میکاپ عروس", "شینیون"], shift: 11 },
      { name: "سارینا اقدمی", title: "کاشتکار ناخن", specialties: ["کاشت ناخن"], shift: 13 },
    ],
    gallery: ["استایل مو", "شینیون", "طراحی ناخن"],
    branches: 1,
  },
];

const REAL_NAMES = [
  { phone: "09129998877", name: "الهام صادقی" },
  { phone: "09121115566", name: "رضا قاسمی" },
  { phone: "09121114455", name: "نازنین احمدی" },
  { phone: "09122225599", name: "محسن کریمی" },
  { phone: "09124443322", name: "شیوا مرادی" },
  { phone: "09129991133", name: "بهاره توکلی" },
  { phone: "09000000002", name: "حسین نعمتی" },
];

const WALKINS = [
  { name: "ملیکا رحیمی", phone: "09122221133" },
  { name: "آرش عظیمی", phone: "09125554466" },
  { name: "نگین فتحی", phone: "09127778899" },
  { name: "سپیده رنجبر", phone: "09123336699" },
  { name: "بابک شیری", phone: "09128882244" },
  { name: "درسا قلی‌زاده", phone: "09126661122" },
  { name: "آرزو یوسفی", phone: "09129990011" },
  { name: "مهدیار صالحی", phone: "09121118855" },
];

const REVIEW_TEXTS = [
  "برخورد پرسنل عالی بود و کار رنگ مو فوق‌العاده شد. حتماً دوباره می‌آیم.",
  "نوبت‌دهی خیلی راحت بود و دقیقاً سر ساعت کارم انجام شد.",
  "کیفیت کاشت ناخن بی‌نظیر بود، دستشان درد نکند.",
  "محیط تمیز و حرفه‌ای است، به همه پیشنهاد می‌کنم.",
  "اولین بار بود می‌آمدم، از میکاپ عروس کاملاً راضی بودم.",
  "قیمت‌ها منصفانه است و کار خیلی تمیز انجام می‌شود.",
];

function atDays(offset, hour, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, min, 0, 0);
  return d;
}

const staffSchedule = (open, close, closedDay) =>
  Array.from({ length: 7 }, (_, d) => ({
    day: d,
    open: `${String(open).padStart(2, "0")}:00`,
    close: `${String(close).padStart(2, "0")}:00`,
    isClosed: d === closedDay,
  }));

/* ─────────────────────── پاک‌سازی داده‌های آزمایشی ─────────────────────── */
async function cleanupJunk() {
  const junkStaff = await prisma.staff.findMany({
    where: { OR: [{ name: "آزمایش" }, { name: { contains: "????" } }] },
    select: { id: true },
  });
  const junkStaffIds = junkStaff.map((s) => s.id);
  if (junkStaffIds.length) {
    await prisma.appointment.updateMany({ where: { employeeId: { in: junkStaffIds } }, data: { employeeId: null } });
    await prisma.review.updateMany({ where: { staffId: { in: junkStaffIds } }, data: { staffId: null } });
    await prisma.staff.deleteMany({ where: { id: { in: junkStaffIds } } });
    console.log(`🧹 ${junkStaffIds.length} کارمند آزمایشی حذف شد`);
  }

  const junkServices = await prisma.service.findMany({
    where: { name: { in: ["تست رنگ", "تست کمیسیون"] } },
    select: { id: true },
  });
  const junkServiceIds = junkServices.map((s) => s.id);
  if (junkServiceIds.length) {
    await prisma.appointment.updateMany({ where: { serviceId: { in: junkServiceIds } }, data: { serviceId: null } });
    await prisma.service.deleteMany({ where: { id: { in: junkServiceIds } } });
    console.log(`🧹 ${junkServiceIds.length} خدمت آزمایشی حذف شد`);
  }

  // نوبت‌های با نام آزمایشی → نام واقعی
  const junkApps = await prisma.appointment.findMany({
    where: { OR: [{ customerName: { contains: "تست" } }, { customerName: { contains: "آزمایش" } }] },
    select: { id: true },
  });
  for (let i = 0; i < junkApps.length; i++) {
    const w = WALKINS[i % WALKINS.length];
    await prisma.appointment.update({
      where: { id: junkApps[i].id },
      data: { customerName: w.name, customerPhone: w.phone },
    });
  }
  if (junkApps.length) console.log(`🧹 ${junkApps.length} نوبت با نام آزمایشی اصلاح شد`);

  const junkCrm = await prisma.salonCustomer.findMany({
    where: { name: { contains: "تست" } },
    select: { id: true },
  });
  for (let i = 0; i < junkCrm.length; i++) {
    const w = WALKINS[(i + 2) % WALKINS.length];
    try {
      await prisma.salonCustomer.update({ where: { id: junkCrm[i].id }, data: { name: w.name, phone: w.phone } });
    } catch (e) {
      // اگر شماره تکراری در همان سالن وجود داشت، از این رد می‌شویم (جلوگیری از کرش).
      if (e.code !== "P2002") throw e;
    }
  }
  if (junkCrm.length) console.log(`🧹 ${junkCrm.length} مشتری CRM آزمایشی اصلاح شد`);
}

/* ─────────────────────── تغییر نام کاربران ناشناس ─────────────────────── */
async function renameCustomers() {
  const map = {};
  for (const r of REAL_NAMES) {
    const u = await prisma.user.findUnique({ where: { phone: r.phone } });
    if (!u) continue;
    if (!u.name || /^\d+$/.test(u.name) || u.name === "کاربر" || u.name === "مشتری") {
      await prisma.user.update({ where: { phone: r.phone }, data: { name: r.name } });
    }
    map[r.phone] = { id: u.id, name: r.name, phone: r.phone };
  }
  return map;
}

/* ─────────────────────── ساخت/به‌روزرسانی یک سالن ─────────────────────── */
async function seedSalon(def, idx) {
  // صاحب سالن + کیف پول + آواتار
  let owner = await prisma.user.findUnique({ where: { phone: def.owner.phone } });
  if (!owner) {
    owner = await prisma.user.create({
      data: { phone: def.owner.phone, name: def.owner.name, role: "SALON_OWNER", verifiedAt: new Date() },
    });
  } else if (!owner.name) {
    owner = await prisma.user.update({ where: { phone: def.owner.phone }, data: { name: def.owner.name } });
  }
  await prisma.wallet.upsert({ where: { ownerId: owner.id }, update: {}, create: { ownerId: owner.id } });

  const avatarFile = `${def.slug}-owner.svg`;
  await writeAsset(avatarFile, svgAvatar([...def.owner.name].slice(0, 2).join(""), def.c1, def.c2));
  if (!owner.avatarUrl) {
    await prisma.user.update({ where: { id: owner.id }, data: { avatarUrl: `/uploads/seed/${avatarFile}` } });
  }

  const logoFile = `${def.slug}-logo.svg`;
  const bannerFile = `${def.slug}-banner.svg`;
  await writeAsset(logoFile, svgLogo([...def.name].find((c) => c !== " "), def.c1, def.c2));
  await writeAsset(bannerFile, svgBanner(def.name, def.tagline, def.c1, def.c2));

  const existing = await prisma.salon.findUnique({ where: { slug: def.slug } });
  const salon = existing
    ? await prisma.salon.update({
        where: { id: existing.id },
        data: {
          plan: "PRO",
          isApproved: true,
          isActive: true,
          subscriptionEndsAt: existing.subscriptionEndsAt ?? atDays(45, 12),
          logoUrl: existing.logoUrl ?? `/uploads/seed/${logoFile}`,
          bannerUrl: existing.bannerUrl ?? `/uploads/seed/${bannerFile}`,
        },
      })
    : await prisma.salon.create({
        data: {
          slug: def.slug,
          name: def.name,
          phone: def.phone,
          city: def.city,
          address: def.address,
          description: `${def.tagline}. ${def.name} در ${def.city} با کادری مجرب و محیطی مدرن آماده ارائه خدمات آرایشی و زیبایی است؛ رزرو نوبت آنلاین و یادآوری خودکار پیامکی، خیال شما را راحت می‌کند.`,
          coverColor: def.c1,
          logoUrl: `/uploads/seed/${logoFile}`,
          bannerUrl: `/uploads/seed/${bannerFile}`,
          ownerId: owner.id,
          isApproved: true,
          isActive: true,
          plan: "PRO",
          subscriptionEndsAt: atDays(45, 12),
        },
      });

  // شعبه‌ها
  const branchCount = await prisma.branch.count({ where: { salonId: salon.id } });
  const branchNames = ["شعبه اصلی", "شعبه ۲"];
  const branchIds = [];
  for (let b = branchCount; b < def.branches; b++) {
    const br = await prisma.branch.create({
      data: { id: `${salon.id}-branch-${b}`, salonId: salon.id, name: branchNames[b] ?? `شعبه ${b + 1}`, city: def.city, address: b === 0 ? def.address : `${def.city} — آدرس شعبه ${b + 1}` },
    });
    branchIds.push(br.id);
  }
  const allBranches = await prisma.branch.findMany({ where: { salonId: salon.id } });
  const mainBranchId = allBranches[0]?.id ?? null;

  // ساعات کاری
  for (let d = 0; d < 7; d++) {
    await prisma.openingHour.upsert({
      where: { salonId_dayOfWeek: { salonId: salon.id, dayOfWeek: d } },
      update: { openTime: d === 6 ? "10:00" : "09:00", closeTime: d === 6 ? "20:00" : "21:00", isClosed: false },
      create: { salonId: salon.id, dayOfWeek: d, openTime: d === 6 ? "10:00" : "09:00", closeTime: d === 6 ? "20:00" : "21:00", isClosed: false },
    });
  }

  // کارکنان
  const staffList = [];
  for (let i = 0; i < def.staff.length; i++) {
    const s = def.staff[i];
    let staff = await prisma.staff.findFirst({ where: { salonId: salon.id, name: s.name } });
    const avatarFile = `${def.slug}-staff-${i}.svg`;
    await writeAsset(avatarFile, svgAvatar([...s.name].slice(0, 2).join(""), def.c1, def.c2));
    const data = {
      salonId: salon.id,
      branchId: mainBranchId,
      name: s.name,
      title: s.title,
      role: s.role ?? "STYLIST",
      specialties: s.specialties,
      bio: `${s.title} در ${def.name} — ${s.specialties.join("، ") || "پذیرش و هماهنگی نوبت‌ها"}`,
      avatarUrl: `/uploads/seed/${avatarFile}`,
      commissionPercent: s.role === "RECEPTION" ? 0 : 15,
      schedule: staffSchedule(s.shift, s.shift + 9, (i + 2) % 7),
      isActive: true,
    };
    if (staff) {
      staff = await prisma.staff.update({ where: { id: staff.id }, data });
    } else {
      staff = await prisma.staff.create({ data });
    }
    staffList.push(staff);
  }

  // خدمات (برای سالن‌های جدید)
  let serviceList = [];
  if (def.serviceIdx) {
    serviceList = await prisma.service.findMany({ where: { salonId: salon.id } });
    for (const si of def.serviceIdx) {
      const s = CATALOG[si];
      const found = serviceList.find((x) => x.name === s.name);
      if (!found) {
        const created = await prisma.service.create({
          data: { salonId: salon.id, branchId: mainBranchId, name: s.name, durationMin: s.durationMin, price: s.price, category: si <= 2 ? "مو" : si <= 5 ? "آرایش" : si <= 7 ? "پوست و ناخن" : "سایر" },
        });
        serviceList.push(created);
      }
    }
  } else {
    serviceList = await prisma.service.findMany({ where: { salonId: salon.id } });
  }

  // گالری (برای سالن‌های جدید)
  if (def.gallery) {
    const existingGallery = await prisma.galleryItem.count({ where: { salonId: salon.id } });
    for (let g = 0; g < def.gallery.length; g++) {
      const title = def.gallery[g];
      const file = `${def.slug}-gallery-${g}.svg`;
      // همیشه خود تصویر را بازنویسی می‌کنیم تا فونت‌های جدید اعمال شوند
      await writeAsset(file, svgGallery(title, [...title][0], def.c1, def.c2, g));
      if (g >= existingGallery) {
        await prisma.galleryItem.create({ data: { salonId: salon.id, title, imageUrl: `/uploads/seed/${file}`, sortOrder: g } });
      }
    }
  }

  return { salon, owner, staffList, serviceList, mainBranchId };
}

/* ─────────────────────── حذف نوبت‌های تکراری (هم‌زمان/هم‌شماره/هم‌وضعیت) ─────────────────────── */
async function dedupeAppointments(salonId) {
  const rows = await prisma.appointment.findMany({
    where: { salonId },
    orderBy: { createdAt: "asc" },
    select: { id: true, startAt: true, customerPhone: true, status: true },
  });
  const seen = new Map();
  const toDelete = [];
  for (const a of rows) {
    const key = `${a.startAt.toISOString()}|${a.customerPhone}|${a.status}`;
    if (seen.has(key)) toDelete.push(a.id);
    else seen.set(key, a.id);
  }
  if (toDelete.length) await prisma.appointment.deleteMany({ where: { id: { in: toDelete } } });
  return toDelete.length;
}

/* ─────────────────────── نوبت‌های گذشته و آینده ─────────────────────── */
async function seedAppointments({ salon, staffList, serviceList, mainBranchId }, usersByPhone, salonIdx) {
  const removed = await dedupeAppointments(salon.id);
  if (removed) console.log(`🧹 ${removed} نوبت تکراری در ${salon.name} حذف شد`);

  const pool = [
    ...Object.values(usersByPhone).map((u) => ({ id: u.id, name: u.name, phone: u.phone })),
    ...WALKINS.map((w) => ({ id: null, name: w.name, phone: w.phone })),
  ];

  // گذشته: ۱۴ نوبت در ۲۸ روز اخیر (ایجاد فقط در صورت خالی بودن زمان/کارمند)
  for (let k = 0; k < 14; k++) {
    const start = atDays(-(1 + ((k * 5 + salonIdx * 3) % 28)), 10 + ((k * 3 + salonIdx * 2) % 9), (k % 4) * 15);
    const svc = serviceList[(k * 2 + salonIdx) % serviceList.length];
    const emp = staffList[k % staffList.length];
    const c = pool[(k + salonIdx) % pool.length];
    const clash = emp
      ? await prisma.appointment.findFirst({ where: { salonId: salon.id, startAt: start, employeeId: emp.id } })
      : null;
    if (clash) continue;
    const status = k % 7 === 6 ? "CANCELLED" : k % 11 === 9 ? "NO_SHOW" : "COMPLETED";
    await prisma.appointment.create({
      data: {
        salonId: salon.id, serviceId: svc?.id ?? null, employeeId: emp?.id ?? null, branchId: mainBranchId,
        customerId: c.id, customerName: c.name, customerPhone: c.phone,
        startAt: start, endAt: new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000),
        status, channel: ["WEBAPP", "MANUAL", "VOICE"][k % 3],
        depositPaid: status === "COMPLETED",
        note: status === "COMPLETED" && k % 3 === 0 ? "مشتری از نتیجه راضی بود" : null,
        cancelReason: status === "CANCELLED" ? "انصراف مشتری" : null,
      },
    });
  }

  // آینده: ماه = امروز ۲ + چهار روز آینده (برای نمایش برنامه روزانه)، بقیه = ۳ نوبت
  const plan = salon.slug === "mah" ? [0, 0, 1, 2, 3, 4] : [0, 1, 3];
  for (let k = 0; k < plan.length; k++) {
    const start = atDays(plan[k], salon.slug === "mah" ? [10, 14, 15, 12, 16, 11][k] : [11, 13, 15][k], 0);
    const svc = serviceList[(k + salonIdx + 2) % serviceList.length];
    const emp = staffList[(k + 1) % staffList.length];
    const c = pool[(k + salonIdx + 4) % pool.length];
    const clash = emp
      ? await prisma.appointment.findFirst({ where: { salonId: salon.id, startAt: start, employeeId: emp.id } })
      : null;
    if (clash) continue;
    await prisma.appointment.create({
      data: {
        salonId: salon.id, serviceId: svc?.id ?? null, employeeId: emp?.id ?? null, branchId: mainBranchId,
        customerId: c.id, customerName: c.name, customerPhone: c.phone,
        startAt: start, endAt: new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000),
        status: k === 0 ? "REQUESTED" : "CONFIRMED",
        channel: k % 2 ? "WEBAPP" : "MANUAL",
        depositAmount: k > 0 ? 100000 : null, depositPaid: k > 0,
      },
    });
  }
}

/* ─────────────────────── نظرات ─────────────────────── */
async function seedReviews(salon, staffList, usersByPhone, salonIdx) {
  const count = await prisma.review.count({ where: { salonId: salon.id } });
  const pool = Object.values(usersByPhone);
  for (let k = count; k < 3; k++) {
    const u = pool[(k + salonIdx) % pool.length];
    await prisma.review.create({
      data: {
        salonId: salon.id,
        customerId: u.id,
        staffId: k % 2 === 0 ? staffList[0]?.id ?? null : null,
        rating: 4 + (k % 2),
        comment: REVIEW_TEXTS[(k + salonIdx) % REVIEW_TEXTS.length],
        createdAt: atDays(-(2 + k * 5), 12),
      },
    });
  }
}

/* ─────────────────────── علاقه‌مندی‌ها و CRM ─────────────────────── */
async function seedFavorites(usersByPhone) {
  const pairs = [
    ["09129998877", "niloofar"], ["09129998877", "ava"],
    ["09121115566", "rose"], ["09121114455", "gisso"],
    ["09122225599", "ava"], ["09122225599", "bahar"],
  ];
  for (const [phone, slug] of pairs) {
    const u = usersByPhone[phone];
    const s = await prisma.salon.findUnique({ where: { slug } });
    if (!u || !s) continue;
    await prisma.favorite.upsert({
      where: { userId_salonId: { userId: u.id, salonId: s.id } },
      update: {},
      create: { userId: u.id, salonId: s.id },
    });
  }
}

async function seedCrm(salon, salonIdx) {
  let count = await prisma.salonCustomer.count({ where: { salonId: salon.id } });
  for (let k = 0; k < 8 && count < 4; k++) {
    const w = WALKINS[(k + salonIdx * 3) % WALKINS.length];
    const created = await prisma.salonCustomer.upsert({
      where: { salonId_phone: { salonId: salon.id, phone: w.phone } },
      update: {},
      create: {
        salonId: salon.id, phone: w.phone, name: w.name,
        visits: 2 + ((k + salonIdx) % 9),
        spend: (3 + ((k + salonIdx) % 12)) * 450000,
        lastVisitAt: atDays(-(3 + k * 6), 13),
        tags: k % 2 === 0 ? ["مشتری وفادار"] : ["عروس"],
      },
    });
    if (created) count++;
  }
}

/* ─────────────────────── اشتراک فعال ─────────────────────── */
async function seedSubscription(salon) {
  const active = await prisma.subscription.findFirst({ where: { salonId: salon.id, status: "ACTIVE" } });
  if (active) return;
  let pkg = await prisma.package.findUnique({ where: { id: "pkg-1" } });
  if (!pkg) {
    pkg = await prisma.package.create({
      data: { id: "pkg-1", name: "پلن حرفه‌ای", plan: "PRO", durationDays: 30, price: 1890000, yearlyPrice: 18900000, features: ["۱ سالن", "نوبت صوتی", "پیامک نامحدود", "گالری نامحدود", "۲۰ کارمند", "وب‌هوک"] },
    });
  }
  await prisma.subscription.create({
    data: { salonId: salon.id, packageId: pkg.id, startsAt: atDays(-15, 12), endsAt: atDays(45, 12), status: "ACTIVE", autoRenew: true },
  });
}

/* ─────────────────────── تماس صوتی نمونه (ماه) ─────────────────────── */
async function seedVoiceCalls(mah, serviceList, staffList, mainBranchId) {
  const count = await prisma.voiceCall.count({ where: { salonId: mah.id } });
  if (count >= 2) return;

  const vc1 = await prisma.voiceCall.create({
    data: {
      salonId: mah.id,
      durationSec: 42,
      transcript: "سلام، سارا احمدی هستم. می‌خواستم برای فردا ساعت سه یک وقت کوتاهی مو رزرو کنم. شماره‌ام هم صفر نهصد و دوازده و سیصد و چهل و پنج و شصت و هفت و هشتاد و نه است.",
      rawText: "سلام سارا احمدی هستم میخواستم برای فردا ساعت ۳ یک وقت کوتاهی مو رزرو کنم شماره ام ۰۹۱۲۳۴۵۶۷۸۹",
      extracted: { customerName: "سارا احمدی", customerPhone: "09123456789", service: "کوتاهی مو", date: "فردا", time: "15:00" },
      status: "DONE",
      createdAt: atDays(-1, 18),
    },
  });

  const start = atDays(1, 15, 0);
  const svc = serviceList.find((s) => s.name === "کوتاهی مو") ?? serviceList[0];
  await prisma.appointment.create({
    data: {
      salonId: mah.id, serviceId: svc?.id ?? null, employeeId: staffList[0]?.id ?? null, branchId: mainBranchId,
      customerName: "سارا احمدی", customerPhone: "09123456789",
      startAt: start, endAt: new Date(start.getTime() + (svc?.durationMin ?? 60) * 60000),
      status: "CONFIRMED", channel: "VOICE", voiceCallId: vc1.id,
    },
  });

  await prisma.voiceCall.create({
    data: {
      salonId: mah.id,
      durationSec: 35,
      transcript: "سلام وقت بخیر، می‌خوام جمعه صبح برای رنگ مو بیام، می‌شه یک نوبت برام بذارید؟",
      rawText: "سلام وقت بخیر میخوام جمعه صبح برای رنگ مو بیام میشه یک نوبت برام بزارید",
      extracted: { customerName: null, customerPhone: null, service: "رنگ مو", date: "جمعه", time: "صبح" },
      status: "FAILED",
      error: "شماره موبایل مشتری قابل تشخیص نبود",
      createdAt: atDays(0, 9),
    },
  });
}

/* ─────────────────────── اجرای اصلی ─────────────────────── */
async function main() {
  console.log("🌱 شروع Seed داده نمونه...");
  await cleanupJunk();
  const usersByPhone = await renameCustomers();
  console.log(`👥 ${Object.keys(usersByPhone).length} کاربر با نام واقعی به‌روز شد`);

  for (let i = 0; i < SALONS.length; i++) {
    const def = SALONS[i];
    const ctx = await seedSalon(def, i);
    await seedAppointments(ctx, usersByPhone, i);
    await seedReviews(ctx.salon, ctx.staffList, usersByPhone, i);
    await seedCrm(ctx.salon, i);
    await seedSubscription(ctx.salon);
    if (def.slug === "mah") await seedVoiceCalls(ctx.salon, ctx.serviceList, ctx.staffList, ctx.mainBranchId);
    console.log(`✅ ${def.name} (${def.city}) آماده شد`);
  }

  await seedFavorites(usersByPhone);

  const [salons, users, staff, appointments, reviews] = await Promise.all([
    prisma.salon.count(),
    prisma.user.count(),
    prisma.staff.count(),
    prisma.appointment.count(),
    prisma.review.count(),
  ]);
  console.log("🎉 پایان Seed داده نمونه");
  console.log(`   سالن‌ها: ${salons} | کاربران: ${users} | کارکنان: ${staff} | نوبت‌ها: ${appointments} | نظرات: ${reviews}`);
  console.log("   آدرس‌ها: /s/mah /s/niloofar /s/rose /s/ava /s/bahar /s/gisso");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
