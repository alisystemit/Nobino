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

export async function extractAppointment(text: string): Promise<ExtractedAppointment> {
  const base: ExtractedAppointment = { rawText: text };

  // تلاش با LLM در صورت موجود بودن کلید
  if (env.OPENAI_API_KEY) {
    try {
      const llmResult = await extractWithLLM(text);
      if (llmResult) return { ...base, ...llmResult };
    } catch {
      // در خطا، به پارسر قاعده‌محور برمی‌گردیم
    }
  }

  // پارسر قاعده‌محور فارسی
  base.name = extractName(text);
  base.phone = extractPhone(text);
  base.time = extractTime(text);
  base.service = extractService(text);

  return base;
}

async function extractWithLLM(text: string): Promise<Omit<ExtractedAppointment, "rawText"> | null> {
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
            "شما استخراج‌کننده اطلاعات نوبت آرایشگاه هستید. از متن فارسی ورودی، فیلدهای name، phone (با پیش‌شماره ۰۹)، service، date (سال-ماه-روز)، time (HH:MM) و note را به‌صورت JSON خروجی بده. اگر مقداری نبود، کلید را حذف کن.",
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
  const m = text.match(PHONE_RE);
  if (!m) return undefined;
  const raw = m[0].replace(/\s/g, "");
  return (raw.startsWith("0") ? raw : `0${raw}`).replace("+98", "0");
}

function extractTime(text: string): string | undefined {
  const m = text.match(/(\d{1,2})[\s:]؟(\d{2})?/);
  // در صورت وجود ساعت عددی
  const hourMatch = text.match(/(\d{1,2})\s*(?=بعدازظهر|عصر|شب|صبح|ظهر)/);
  const plain = text.match(/(\d{1,2})\s*(?=صبح|ظهر|عصر|شب)/);
  const from = hourMatch ?? plain;
  if (!from) return undefined;
  let hour = parseInt(from[1], 10);
  if (text.includes("بعدازظهر") || text.includes("عصر") || text.includes("شب")) {
    if (hour < 12) hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:00`;
}

function extractName(text: string): string | undefined {
  const m = text.match(/(?:اسم من|نام من|مِنم)\s+([\u0600-\u06FF\s]{2,30})/);
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

function extractService(text: string): string | undefined {
  for (const [re, label] of SERVICE_KEYWORDS) {
    if (re.test(text)) return label;
  }
  return undefined;
}

export { DAY_NAMES };
