import { env } from "@/lib/env";

/**
 * استخراج اطلاعات نوبت از متن فارسی.
 * ابتدا سعی می‌کند با LLM (OpenAI) ساختار JSON استخراج کند و
 * در نبود کلید، از یک پارسر قاعده‌محور فارسی استفاده می‌کند.
 */
export type ExtractedAppointment = {
  name?: string;
  phone?: string;
  service?: string;
  date?: string; // ISO یا متن
  time?: string; // "10:00"
  note?: string;
  rawText: string;
};

const DAY_NAMES = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

/** تبدیل ارقام فارسی به لاتین */
function normalizeDigits(text: string): string {
  return text.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** تبدیل ارقام فارسی/عربی به لاتین */
export function normalizePersianDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(d);
    if (fa >= 0) return String(fa);
    const ar = "٠١٢٣٤٥٦٧٨٩".indexOf(d);
    return String(ar);
  });
}

const WEEKDAY_TARGET: Record<string, number> = {
  "شنبه": 6,
  "یکشنبه": 0,
  "دوشنبه": 1,
  "سه‌شنبه": 2,
  "سه شنبه": 2,
  "چهارشنبه": 3,
  "پنجشنبه": 4,
  "جمعه": 5,
};

/**
 * استخراج تاریخ از عبارت‌های نسبی فارسی:
 * امروز / فردا / پس‌فردا / نام روزهای هفته / تاریخ میلادی عددی.
 */
export function resolveDate(text: string, timezone = "Asia/Tehran"): string | undefined {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = fmt.format(new Date());
  if (/امروز/.test(text)) return todayStr;
  if (/پس\s?فردا/.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return fmt.format(d);
  }
  if (/فردا/.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return fmt.format(d);
  }
  for (const [name, target] of Object.entries(WEEKDAY_TARGET)) {
    if (text.includes(name)) {
      const parts = todayStr.split("-").map(Number);
      const today = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
      const todayDay = today.getUTCDay();
      let diff = (target - todayDay + 7) % 7;
      if (diff === 0 && !/این|همین/.test(text)) diff = 7;
      const d = new Date(today.getTime() + diff * 864e5);
      return d.toISOString().slice(0, 10);
    }
  }
  const numeric = normalizeDigits(text).match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (numeric) {
    const y = Number(numeric[1]);
    if (y > 1900) {
      return `${numeric[1]}-${String(numeric[2]).padStart(2, "0")}-${String(numeric[3]).padStart(2, "0")}`;
    }
  }
  return undefined;
}

export async function extractAppointment(
  text: string,
  opts?: { timezone?: string; serviceNames?: string[] }
): Promise<ExtractedAppointment> {
  const base: ExtractedAppointment = { rawText: text };

  // تلاش با LLM در صورت موجود بودن کلید
  if (env.OPENAI_API_KEY) {
    try {
      const llmResult = await extractWithLLM(text, opts?.serviceNames);
      if (llmResult) return { ...base, ...llmResult };
    } catch {
      // در خطا، به پارسر قاعده‌محور برمی‌گردیم
    }
  }

  // پارسر قاعده‌محور فارسی
  base.name = extractName(text);
  base.phone = extractPhone(text);
  base.time = extractTime(text);
  base.service = extractService(text, opts?.serviceNames);
  const date = resolveDate(text, opts?.timezone);
  if (date) base.date = date;

  return base;
}

export type ExtractedField = "name" | "phone" | "service" | "date" | "time";

const FIELD_HINTS: Record<ExtractedField, string> = {
  name: "نام و نام خانوادگی مشتری (فارسی)",
  phone: "شماره موبایل ۱۱ رقمی که با ۰۹ شروع می‌شود",
  service: "نام خدمت آرایشگاه",
  date: "تاریخ نوبت به شکل سال-ماه-روز میلادی",
  time: "ساعت نوبت به شکل HH:MM",
};

/** تبدیل ارقامِ گفته‌شده با کلمه («نه یک دو سه…») به رقم لاتین */
function digitsFromSpoken(text: string): string {
  const words: Record<string, string> = {
    صفر: "0", یک: "1", دو: "2", سه: "3", چهار: "4", پنج: "5",
    شش: "6", هفت: "7", هشت: "8", نه: "9",
  };
  let t = normalizePersianDigits(text);
  for (const [w, d] of Object.entries(words)) t = t.replace(new RegExp(w, "g"), d);
  return t.replace(/\s+/g, "").replace(/[^\d+]/g, "");
}

/**
 * استخراج فقط یک فیلد از یک صوت کوتاه (پاسخ تکمیلی مشتری).
 * وقتی ربات فیلدی را نفهمیده، مشتری فقط همان را می‌گوید؛
 * این تابع همان یک فیلد را برمی‌گرداند تا با نتیجه قبلی ادغام شود.
 */
export async function extractSingleField(
  field: ExtractedField,
  text: string,
  opts?: { timezone?: string; serviceNames?: string[] }
): Promise<ExtractedAppointment> {
  const base: ExtractedAppointment = { rawText: text };

  if (env.OPENAI_API_KEY) {
    try {
      const serviceHint = field === "service" && opts?.serviceNames?.length
        ? `\nخدمات واقعی سالن: ${opts.serviceNames.join("، ")}`
        : "";
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          messages: [
            {
              role: "system",
              content:
                `مشتری پاسخ کوتاهی به فارسی داده که فقط مقدار فیلد «${field}» را می‌رساند (${FIELD_HINTS[field]}).` +
                ` خروجی فقط JSON با یک کلید ${field} باشد. اگر مقدار قابل تشخیص نیست، خروجی {} باشد.` +
                serviceHint,
            },
            { role: "user", content: text },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: { message: { content: string } }[] };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as Partial<ExtractedAppointment>;
          if (parsed && parsed[field]) return { ...base, [field]: String(parsed[field]) };
        }
      }
    } catch {
      // در خطا، به قاعده‌محور برمی‌گردیم
    }
  }

  // قاعده‌محور
  switch (field) {
    case "phone": {
      // ارقام با فاصله یا به‌صورت کلمه‌ای («نه یک دو…»)
      const digits = digitsFromSpoken(text);
      const m = digits.match(/9\d{9}/);
      if (m) return { ...base, phone: `0${m[0]}` };
      const p = extractPhone(text);
      if (p) return { ...base, phone: p };
      break;
    }
    case "time": {
      const t = extractTime(text);
      if (t) return { ...base, time: t };
      break;
    }
    case "date": {
      const d = resolveDate(text, opts?.timezone);
      if (d) return { ...base, date: d };
      break;
    }
    case "service": {
      const s = extractService(text, opts?.serviceNames);
      if (s) return { ...base, service: s };
      break;
    }
    case "name": {
      const n = extractName(text);
      if (n) return { ...base, name: n };
      // اگر کل پاسخ فقط نام باشد (عبارت کوتاه بدون رقم و تاریخ)
      const cleaned = text.replace(/[۰-۹0-9+\-:.,;،؛?!؟]/g, "").trim();
      const words = cleaned.split(/\s+/).filter(Boolean);
      if (words.length >= 1 && words.length <= 4 && cleaned.length >= 3) {
        return { ...base, name: cleaned.replace(/^(سلام|مشتری|من)\s+/i, "") };
      }
      break;
    }
  }
  return base;
}

async function extractWithLLM(
  text: string,
  serviceNames?: string[]
): Promise<Omit<ExtractedAppointment, "rawText"> | null> {
  const serviceHint = serviceNames?.length
    ? `\nخدمات واقعی سالن (service باید دقیقاً یکی از این‌ها باشد): ${serviceNames.join("، ")}`
    : "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "شما استخراج‌کننده اطلاعات نوبت آرایشگاه هستید. از متن فارسی ورودی، فیلدهای name، phone (با پیش‌شماره ۰۹)، service، date (سال-ماه-روز میلادی) و time (HH:MM) و note را به‌صورت JSON خروجی بده. اگر مقداری نبود، کلید را حذف کن." +
            serviceHint,
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ─── توابع قاعده‌محور فارسی ────────────────────────────────────────────

const PHONE_RE = /(?:0|\+98)?9\d{9}/g;

function extractPhone(text: string): string | undefined {
  const normalized = normalizePersianDigits(text);
  const m = normalized.match(PHONE_RE);
  if (!m) return undefined;
  const raw = m[0].replace(/\s/g, "");
  return (raw.startsWith("0") ? raw : `0${raw}`).replace("+98", "0");
}

function extractTime(text: string): string | undefined {
  const t = normalizeDigits(text);
  // الگوی ساعت:دقیقه (مثلاً 10:30)
  const hm = t.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const h = parseInt(hm[1], 10);
    const mm = parseInt(hm[2], 10);
    if (h >= 0 && h <= 23 && mm >= 0 && mm <= 59) {
      return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }
  // الگوی «ساعت ۱۰» یا «۱۰ صبح/عصر/شب/ظهر/بعدازظهر»
  const m = t.match(/(?:ساعت\s*)?(\d{1,2})\s*(صبح|ظهر|عصر|شب|بعدازظهر|بعد از ظهر)?/);
  if (!m || m[1] === undefined) return undefined;
  let hour = parseInt(m[1], 10);
  if (hour >= 13 && hour <= 23) return `${String(hour).padStart(2, "0")}:00`;
  if (hour < 1 || hour > 12) return undefined;
  const part = m[2];
  if (part === "عصر" || part === "شب" || part === "بعدازظهر" || part === "بعد از ظهر") {
    if (hour < 12) hour += 12;
  } else if (part === "ظهر") {
    if (hour < 12) hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:00`;
}

function extractName(text: string): string | undefined {
  const m = text.match(/(?:اسم من|نام من|مِنم|من)\s+([\u0600-\u06FF]{2,30})/);
  return m ? m[1].trim() : undefined;
}

const SERVICE_KEYWORDS: [RegExp, string][] = [
  [/(کوتاهی مو|کوتاه کردن مو)/, "کوتاهی مو"],
  [/(رنگ مو|رنگ کردن)/, "رنگ مو"],
  [/(کاشت ناخن|ناخن)/, "کاشت ناخن"],
  [/(میکاپ|آرایش صورت|گریم)/, "میکاپ"],
  [/(اصلاح ابرو|ابرو)/, "اصلاح ابرو"],
  [/(پاکسازی پوست|فیشیال)/, "پاکسازی پوست"],
  [/(لمینت|مژه)/, "لمینت مژه"],
  [/(اتو مو|صاف کردن مو)/, "اتو مو"],
  [/(استایل|حجم مو)/, "استایل مو"],
];

function extractService(text: string, serviceNames?: string[]): string | undefined {
  // اگر فهرست خدمات واقعی سالن موجود باشد، اول تطابق با آن‌ها
  if (serviceNames?.length) {
    for (const name of serviceNames) {
      const simple = name.replace(/[^\u0600-\u06FF\s]/g, "").trim();
      if (simple.length >= 3 && text.includes(simple)) return name;
    }
  }
  for (const [re, label] of SERVICE_KEYWORDS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

export { DAY_NAMES };
