import { prisma } from "@/lib/prisma";
import { transcribeWithFallback } from "@/lib/ai/stt";
import { extractAppointment, extractSingleField, type ExtractedAppointment, type ExtractedField } from "@/lib/ai/parser";
import { storeFile } from "@/lib/storage";
import { withinLimit } from "@/lib/plans/limits";
import { json, apiError } from "@/lib/utils";

const FIELDS: ExtractedField[] = ["name", "phone", "service", "date", "time"];

/**
 * دریافت فایل صوتی، تبدیل گفتار فارسی به متن (Whisper)
 * و استخراج اطلاعات نوبت. نتیجه برای تأیید مشتری برمی‌گردد.
 *
 * حالت دوم (پرسش مجدد فیلد): اگر ربات فیلدی را نفهمید، مشتری فقط همان
 * فیلد را می‌گوید؛ با پارامترهای `field` و `partial` مقدار جدید با نتیجه
 * قبلی ادغام می‌شود و خروجی کامل دوباره در دیتابیس ثبت می‌گردد.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const salonId = (form.get("salonId") as string) ?? "";
    const userPhone = (form.get("phone") as string) ?? "";
    const field = (form.get("field") as string) ?? "";
    const partialRaw = (form.get("partial") as string) ?? "";
    const voiceCallId = (form.get("voiceCallId") as string) ?? "";

    if (!audio) return json({ success: false, error: "فایل صوتی ارسال نشده است" }, { status: 400 });
    if (!salonId) return json({ success: false, error: "salonId الزامی است" }, { status: 400 });
    if (field && !FIELDS.includes(field as ExtractedField)) {
      return json({ success: false, error: "فیلد نامعتبر است" }, { status: 400 });
    }

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    if (!(await withinLimit(salonId, "voiceBooking"))) {
      return json(
        { success: false, error: "رزرو صوتی در پلن فعلی این سالن فعال نیست. برای ارتقای پلن به بخش اشتراک مراجعه کنید." },
        { status: 403 }
      );
    }

    // ذخیره فایل صوتی (Blob در پروداکشن، محلی در توسعه)
    const stored = await storeFile(audio, { dir: "voice" });

    const buffer = Buffer.from(await audio.arrayBuffer());

    // پردازش با زنجیره ربات‌های STT (OpenAI → Groq → Mock)
    const { transcript, provider } = await transcribeWithFallback(new Uint8Array(buffer), {
      filename: audio.name || "recording.webm",
      mimeType: audio.type,
    });

    // خدمات واقعی سالن برای تطبیق دقیق‌تر سرویس در استخراج
    const services = await prisma.service.findMany({
      where: { salonId, isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    const serviceNames = services.map((s) => s.name);

    // ── حالت پرسش مجدد: فقط یک فیلد از صوت کوتاه استخراج و ادغام می‌شود ──
    if (field) {
      let partial: Partial<ExtractedAppointment> = {};
      try {
        partial = partialRaw ? (JSON.parse(partialRaw) as Partial<ExtractedAppointment>) : {};
      } catch {
        partial = {};
      }

      const single = await extractSingleField(field as ExtractedField, transcript, {
        timezone: salon.timezone,
        serviceNames,
      });
      const value = single[field as ExtractedField] as string | undefined;
      const extracted: Partial<ExtractedAppointment> = value ? { ...partial, [field]: value } : { ...partial };

      // ادغام و ثبت مجدد در همان رکورد تماس صوتی (خروجی کامل → دیتابیس)
      let recordId = voiceCallId;
      if (recordId) {
        const existing = await prisma.voiceCall.findUnique({ where: { id: recordId } });
        if (!existing || existing.salonId !== salonId) recordId = "";
      }
      if (!recordId) {
        const vc = await prisma.voiceCall.create({
          data: {
            salonId,
            audioUrl: stored.url,
            durationSec: Math.round(audio.size / 8000),
            status: "PROCESSING",
            extracted: { salonSlug: salon.slug, phone: userPhone } as never,
          },
        });
        recordId = vc.id;
      }
      const record = await prisma.voiceCall.findUnique({ where: { id: recordId } });
      const prev = (record?.extracted ?? {}) as Record<string, unknown>;

      await prisma.voiceCall.update({
        where: { id: recordId },
        data: {
          audioUrl: stored.url,
          transcript: record?.transcript
            ? `${record.transcript}\n[پاسخ تکمیلی ${field}]: ${transcript}`
            : transcript,
          extracted: { ...prev, ...(value ? { [field]: value } : {}), provider } as never,
          status: "DONE",
        },
      });

      return json({
        success: true,
        voiceCallId: recordId,
        transcript,
        provider,
        field,
        fieldValue: value ?? null,
        extracted,
        salon: { id: salon.id, name: salon.name, slug: salon.slug },
      });
    }

    // ── حالت عادی: استخراج کامل نوبت ──
    const voiceCall = await prisma.voiceCall.create({
      data: {
        salonId,
        audioUrl: stored.url,
        durationSec: Math.round(audio.size / 8000),
        status: "PROCESSING",
        extracted: { salonSlug: salon.slug, phone: userPhone } as never,
      },
    });

    const extracted = await extractAppointment(transcript, {
      timezone: salon.timezone,
      serviceNames,
    });

    await prisma.voiceCall.update({
      where: { id: voiceCall.id },
      data: {
        transcript,
        extracted: { ...extracted, provider } as never,
        status: "DONE",
      },
    });

    return json({
      success: true,
      voiceCallId: voiceCall.id,
      transcript,
      provider,
      extracted,
      salon: { id: salon.id, name: salon.name, slug: salon.slug },
    });
  } catch (err) {
    return apiError(err);
  }
}
