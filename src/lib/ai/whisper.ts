import { env } from "@/lib/env";

/**
 * تبدیل گفتار به متن (STT) — فارسی.
 * درایورها: openai (Whisper API) | mock
 */
export interface TranscribeResult {
  transcript: string;
  provider: "openai" | "mock";
  audioUrl?: string;
  durationSec?: number;
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: { filename?: string; mimeType?: string }
): Promise<TranscribeResult> {
  if (env.VOICE_PROVIDER === "openai") {
    return transcribeWithOpenAI(audioBuffer, options);
  }
  return transcribeWithMock(audioBuffer, options);
}

async function transcribeWithOpenAI(
  audioBuffer: Buffer,
  options?: { filename?: string; mimeType?: string }
): Promise<TranscribeResult> {
  const form = new FormData();
  const filename = options?.filename ?? "recording.webm";
  const mime = options?.mimeType ?? "audio/webm";
  form.append("file", new Blob([new Uint8Array(audioBuffer)], { type: mime }), filename);
  form.append("model", env.OPENAI_MODEL);
  form.append("language", "fa");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper خطا ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { text?: string };
  return { transcript: data.text ?? "", provider: "openai" };
}

/**
 * درایور شبیه‌سازی برای توسعه — یک جمله نمونه فارسی برمی‌گرداند
 * تا کل حلقه بدون کلید API قابل تست باشد.
 */
async function transcribeWithMock(
  _audioBuffer: Buffer,
  _options?: { filename?: string; mimeType?: string }
): Promise<TranscribeResult> {
  const samples = [
    "سلام، می‌خواستم برای فردا ساعت ده صبح نوبت کوتاهی مو بگیرم. نام من سارا احمدی است و شماره موبایلم ۰۹۱۲۳۴۵۶۷۸ است.",
    "برای امروز ساعت شش عصر یک نوبت رنگ مو می‌خواهم. اسم من مریم است.",
    "دو شنبه ساعت دوازده ظهر برای کاشت ناخن وقت می‌گیرم. شماره من ۰۹۹۱۲۳۴۵۶۷ است.",
  ];
  const transcript = samples[Math.floor(Math.random() * samples.length)];
  return { transcript, provider: "mock" };
}
