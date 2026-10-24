import { getSetting } from "@/lib/settings";

/**
 * زنجیره ربات‌های تبدیل گفتار به متن (STT) با fallback.
 * ترتیب تلاش: OpenAI Whisper → Groq (Whisper رایگان) → Mock.
 * اگر یکی در دسترس نبود (کلید نداشت یا خطا داد) به بعدی می‌رویم.
 */

export type SttProvider = "openai" | "groq" | "mock";

async function isConfigured(id: SttProvider): Promise<boolean> {
  const key = await getSetting(`stt.${id}.key`);
  return Boolean(key);
}

async function callProvider(id: SttProvider, audio: Uint8Array, filename: string, mime: string): Promise<string> {
  const key = await getSetting(`stt.${id}.key`);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), filename);
  form.append("model", id === "groq" ? "whisper-large-v3-turbo" : "whisper-1");
  form.append("language", "fa");

  const url = id === "groq" ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${id} HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}

/** تبدیل گفتار به متن با fallback بین ربات‌ها */
export async function transcribeWithFallback(
  audio: Uint8Array,
  opts?: { filename?: string; mimeType?: string }
): Promise<{ transcript: string; provider: SttProvider }> {
  const filename = opts?.filename ?? "recording.webm";
  const mime = opts?.mimeType ?? "audio/webm";

  for (const id of ["openai", "groq"] as SttProvider[]) {
    if (!(await isConfigured(id))) continue;
    try {
      const transcript = await callProvider(id, audio, filename, mime);
      if (transcript) return { transcript, provider: id };
    } catch {
      // به ربات بعدی برو
    }
  }

  // fallback نهایی: Mock (محلی)
  const samples = [
    "سلام، می‌خواستم برای فردا ساعت ده صبح نوبت کوتاهی مو بگیرم. نام من سارا احمدی است و شماره موبایلم ۰۹۱۲۳۴۵۶۷۸ است.",
    "برای امروز ساعت شش عصر یک نوبت رنگ مو می‌خواهم. اسم من مریم است.",
    "دو شنبه ساعت دوازده ظهر برای کاشت ناخن وقت می‌گیرم. شماره من ۰۹۹۱۲۳۴۵۶۷ است.",
  ];
  return { transcript: samples[Math.floor(Math.random() * samples.length)], provider: "mock" };
}
