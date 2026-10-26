/**
 * نوبینو — تولیدکنندهٔ تصاویر نمونه (SVG برداری)
 *
 * چرا SVG؟ فایل‌ها داخل ریپو در `public/seed/` نگهداری می‌شوند، پس روی هر
 * سروری (بدون اینترنت و بدون وابستگی به لینک بیرونی) لود می‌شوند و چند کیلوبایت
 * حجم دارند. قبلاً فونت فارسی به‌صورت base64 داخل هر فایل جاسازی می‌شد و هر
 * تصویر ~۸۷KB می‌شد؛ حالا فقط از stack فونت سیستمی استفاده می‌شود.
 *
 * همهٔ خروجی‌ها فقط از ورودی‌های متنی (نام/شعار) ساخته می‌شوند و هیچ
 * وابستگی‌ای به دیتابیس ندارند؛ برای همین `seed-demo.mjs` و `prisma/seed.mjs`
 * هر دو می‌توانند از همین توابع استفاده کنند.
 */

const esc = (s) => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** مسیر عمومی تصاویر نمونه (نسبت به ریشهٔ public) */
export const SEED_URL = "/seed";

const F_BOLD = "'Yekan','Vazirmatn',Tahoma,sans-serif";
const F_REG = "'IRANSans','Vazirmatn',Tahoma,sans-serif";

/** گرادیان اصلی + هالهٔ نورانی؛ در همهٔ تصاویر مشترک است */
const bg = (c1, c2, w, h, id = "g") =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
  `<radialGradient id="${id}h" cx="0.2" cy="0.1" r="0.9"><stop offset="0" stop-color="#fff" stop-opacity="0.28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="${w}" height="${h}" fill="url(#${id})"/><rect width="${w}" height="${h}" fill="url(#${id}h)"/>`;

/** قیچی کوچک — نماد مشترک آرایشگری */
const scissors = (x, y, s = 1, o = 0.5) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="7" stroke-linecap="round">` +
  `<circle cx="0" cy="34" r="12"/><circle cx="0" cy="72" r="12"/>` +
  `<path d="M9 26 46 -2M9 64 46 92M32 40 58 12M32 58 58 86"/></g>`;

/** بطری و شیشه روی پیشخوان */
const bottles = (x, y, o = 0.22) =>
  `<g fill="#fff" fill-opacity="${o}">` +
  `<rect x="${x}" y="${y - 46}" width="18" height="46" rx="7"/><rect x="${x + 4}" y="${y - 58}" width="10" height="14" rx="4"/>` +
  `<rect x="${x + 30}" y="${y - 62}" width="20" height="62" rx="8"/><rect x="${x + 35}" y="${y - 74}" width="10" height="14" rx="4"/>` +
  `<rect x="${x + 62}" y="${y - 34}" width="16" height="34" rx="6"/>` +
  `<circle cx="${x + 92}" cy="${y - 14}" r="14"/></g>`;

/** صندلی آرایشگری (نمای دوبعدی) */
const chair = (x, y, o = 0.26) =>
  `<g fill="#fff" fill-opacity="${o}">` +
  `<rect x="${x}" y="${y - 118}" width="62" height="92" rx="26"/>` +
  `<rect x="${x - 26}" y="${y - 34}" width="118" height="22" rx="11"/>` +
  `<rect x="${x + 22}" y="${y - 12}" width="14" height="44" rx="6" fill-opacity="${o * 0.8}"/>` +
  `<ellipse cx="${x + 29}" cy="${y + 34}" rx="44" ry="9" fill-opacity="${o * 0.7}"/>` +
  `<rect x="${x - 44}" y="${y - 74}" width="18" height="52" rx="9" fill-opacity="${o * 0.75}"/>` +
  `</g>`;

/** گلدان/گیاه تزئینی */
const plant = (x, y, o = 0.2) =>
  `<g fill="#fff" fill-opacity="${o}">` +
  `<path d="M${x} ${y}q-30 -26 -6 -56 6 34 22 44-4 12-16 12Z"/>` +
  `<path d="M${x + 4} ${y}q34 -20 22 -58-22 26-30 46 4 8 8 12Z"/>` +
  `<rect x="${x - 14}" y="${y + 2}" width="40" height="34" rx="10" fill-opacity="${o * 1.2}"/>` +
  `</g>`;

/** آینهٔ قوسی با نور دور تا دور */
const mirror = (x, y, w, h, o = 0.16) =>
  `<g>` +
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" fill-opacity="${o}"/>` +
  `<rect x="${x + 12}" y="${y + 12}" width="${w - 24}" height="${h - 24}" rx="${(w - 24) / 2}" fill="#fff" fill-opacity="0.10"/>` +
  `<path d="M${x + 22} ${y + h - 40}L${x + w - 26} ${y + 34}" stroke="#fff" stroke-opacity="0.22" stroke-width="10" stroke-linecap="round"/>` +
  `</g>`;

/* ───────────────────────── لوگو ───────────────────────── */

/** لوگو: کاشی گرد + تک‌حرف + قیچی کوچک */
export function svgLogo(letter, c1, c2) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    bg(c1, c2, 256, 256) +
    `<circle cx="64" cy="52" r="30" fill="#fff" fill-opacity="0.18"/>` +
    `<circle cx="206" cy="198" r="44" fill="#fff" fill-opacity="0.10"/>` +
    scissors(150, 150, 0.5, 0.35) +
    `<text x="128" y="142" text-anchor="middle" dominant-baseline="central" font-size="112" font-weight="bold" fill="#fff" font-family="${F_BOLD}">${esc(letter)}</text>` +
    `</svg>`
  );
}

/* ───────────────────────── بنر سالن ───────────────────────── */

/**
 * بنر ۱۲۰۰×۴۰۰: صحنهٔ داخل سالن در سمت چپ، نام و شعار در سمت راست (RTL).
 * نام/شعار به‌صورت متن واقعی رندر می‌شود تا اگر فونت نبود، باز خوانا بماند.
 */
export function svgBanner(name, tagline, c1, c2, variant = 0) {
  const scene =
    mirror(70, 60, 170, 250) +
    chair(300, 320) +
    bottles(430, 300) +
    plant(560, 300) +
    // پیشخوان شیشه‌ای
    `<rect x="415" y="300" width="160" height="10" rx="5" fill="#fff" fill-opacity="0.28"/>` +
    `<rect x="415" y="310" width="160" height="46" rx="12" fill="#fff" fill-opacity="0.10"/>` +
    // خط کف
    `<rect x="0" y="356" width="1200" height="44" fill="#000" fill-opacity="0.10"/>`;
  const variantMark =
    variant % 3 === 0
      ? `<circle cx="1090" cy="70" r="120" fill="#fff" fill-opacity="0.07"/>`
      : variant % 3 === 1
        ? `<path d="M960 0q180 120 60 400h220V0Z" fill="#fff" fill-opacity="0.06"/>`
        : `<rect x="980" y="-40" width="160" height="480" rx="80" transform="rotate(18 1060 200)" fill="#fff" fill-opacity="0.06"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">` +
    bg(c1, c2, 1200, 400) +
    variantMark +
    `<circle cx="240" cy="40" r="70" fill="#fff" fill-opacity="0.08"/>` +
    scene +
    scissors(660, 250, 0.75, 0.22) +
    `<text x="1140" y="188" text-anchor="end" font-size="66" font-weight="bold" fill="#fff" font-family="${F_BOLD}">${esc(name)}</text>` +
    `<text x="1140" y="242" text-anchor="end" font-size="30" fill="#fff" fill-opacity="0.86" font-family="${F_REG}">${esc(tagline)}</text>` +
    `<rect x="1010" y="266" width="130" height="5" rx="2.5" fill="#fff" fill-opacity="0.55"/>` +
    `</svg>`
  );
}

/* ───────────────────────── گالری ───────────────────────── */

const GALLERY_ICONS = {
  /** مو: موج مو + قیچی */
  hair: `<g fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="10" stroke-linecap="round">
    <path d="M240 130q60 90 0 180q-50 80 10 150"/><path d="M320 110q70 100 8 190q-46 76 14 150"/>
    <path d="M400 130q56 88 -2 176q-44 74 12 146"/></g>` + scissors(490, 150, 1.15, 0.75),
  /** میکاپ: ریال + رژلب */
  makeup: `<g fill="#fff">
    <rect x="300" y="120" width="26" height="200" rx="13" fill-opacity="0.75"/><rect x="305" y="90" width="16" height="46" rx="8" fill-opacity="0.95"/>
    <rect x="380" y="150" width="58" height="190" rx="18" fill-opacity="0.55"/><rect x="386" y="112" width="46" height="52" rx="16" fill-opacity="0.85"/>
    <circle cx="480" cy="250" r="34" fill-opacity="0.35"/></g>`,
  /** ناخن: بطری لاک + قطره */
  nails: `<g fill="#fff">
    <rect x="300" y="210" width="110" height="150" rx="26" fill-opacity="0.6"/><rect x="336" y="150" width="38" height="66" rx="12" fill-opacity="0.85"/>
    <path d="M470 170q46 54 0 96q-40 -42 0 -96Z" fill-opacity="0.7"/><circle cx="520" cy="320" r="26" fill-opacity="0.3"/></g>`,
  /** پوست: قطره آب + برگ */
  skin: `<g fill="#fff">
    <path d="M380 120q86 110 0 178q-86 -68 0 -178Z" fill-opacity="0.65"/>
    <path d="M470 300q68 -96 140 -96-16 92-110 106-22 -6-30 -10Z" fill-opacity="0.45"/>
    <circle cx="290" cy="330" r="30" fill-opacity="0.28"/></g>`,
  /** مژه/ابرو: چشم */
  lashes: `<g fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="10" stroke-linecap="round">
    <path d="M260 260q130 -110 260 0-130 100 -260 0Z"/><circle cx="390" cy="246" r="34" fill="#fff" fill-opacity="0.5" stroke="none"/>
    <path d="M300 190l-18 -34M350 172l-10 -38M410 172l10 -38M460 190l20 -32"/></g>`,
  /** ماساژ/رفلکس: دست + حباب */
  massage: `<g fill="#fff" fill-opacity="0.6"><circle cx="360" cy="230" r="66"/><circle cx="470" cy="200" r="34"/><circle cx="500" cy="270" r="26"/><circle cx="450" cy="330" r="24"/></g>`,
};

/**
 * کارت گالری ۸۰۰×۶۰۰؛ آیکون از روی عنوان انتخاب می‌شود تا هر سرویس
 * تصویر خودش را داشته باشد (قبلاً همهٔ کارت‌ها فقط یک حرف بودند).
 */
export function svgGallery(title, label, c1, c2, idx = 0) {
  const t = String(title || "");
  const icon =
    /ناخن|پدیکور|مانیکور/.test(t) ? GALLERY_ICONS.nails
      : /میکاپ|عروس|شینیون|ابرو|مژه|لمینت/.test(t) ? (/مژه|ابرو|لمینت/.test(t) ? GALLERY_ICONS.lashes : GALLERY_ICONS.makeup)
        : /پوست|پاکسازی|ماساژ|اسکین/.test(t) ? (/ماساژ/.test(t) ? GALLERY_ICONS.massage : GALLERY_ICONS.skin)
          : /مو|رنگ|کراتین|مش|لایت|کوتاهی/.test(t) ? GALLERY_ICONS.hair
            : Object.values(GALLERY_ICONS)[idx % 6];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">` +
    bg(c1, c2, 800, 600, "gg") +
    `<circle cx="640" cy="110" r="90" fill="#fff" fill-opacity="0.10"/>` +
    `<circle cx="150" cy="470" r="70" fill="#fff" fill-opacity="0.10"/>` +
    icon +
    `<text x="740" y="86" text-anchor="end" font-size="120" font-weight="bold" fill="#fff" fill-opacity="0.16" font-family="${F_BOLD}">${esc(label)}</text>` +
    `<rect x="0" y="470" width="800" height="130" fill="#000" fill-opacity="0.22"/>` +
    `<text x="400" y="548" text-anchor="middle" font-size="42" font-weight="bold" fill="#fff" font-family="${F_BOLD}">${esc(title)}</text>` +
    `</svg>`
  );
}

/* ───────────────────────── آواتار ───────────────────────── */

/** آواتار: سیلوэт آدم + حرف اول؛ برای کارکنان و صاحب سالن */
export function svgAvatar(initials, c1, c2) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    bg(c1, c2, 256, 256, "ga") +
    `<circle cx="128" cy="98" r="42" fill="#fff" fill-opacity="0.30"/>` +
    `<path d="M40 236q28 -74 88 -74t88 74Z" fill="#fff" fill-opacity="0.30"/>` +
    `<text x="128" y="196" text-anchor="middle" dominant-baseline="central" font-size="58" font-weight="bold" fill="#fff" fill-opacity="0.92" font-family="${F_BOLD}">${esc(initials)}</text>` +
    `</svg>`
  );
}

/** بنر عمومی صفحهٔ اصلی/هیرو (وقتی سالی بنر ندارد) */
export function svgHero(c1 = "#f472b6", c2 = "#7c3aed") {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">` +
    bg(c1, c2, 1200, 400, "gh") +
    mirror(80, 50, 160, 260) + chair(300, 330) + bottles(430, 310) + plant(560, 310) +
    scissors(700, 200, 1, 0.25) +
    `<rect x="0" y="356" width="1200" height="44" fill="#000" fill-opacity="0.10"/>` +
    `</svg>`
  );
}
