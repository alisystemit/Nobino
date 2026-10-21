import { prisma } from "@/lib/prisma";
import { transcribeAudio } from "@/lib/ai/whisper";
import { extractAppointment } from "@/lib/ai/parser";
import { json, apiError } from "@/lib/utils";

/**
 * دریافت فایل صوتی، تبدیل گفتار فارسی به متن (Whisper)
 * و استخراج اطلاعات نوبت. نتیجه برای تأیید مشتری برمی‌گردد.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio") as File | null;
    const salonId = (form.get("salonId") as string) ?? "";
    const userPhone = (form.get("phone") as string) ?? "";

    if (!audio) return json({ success: false, error: "فایل صوتی ارسال نشده است" }, { status: 400 });
    if (!salonId) return json({ success: false, error: "salonId الزامی است" }, { status: 400 });

    const salon = await prisma.salon.findUnique({ where: { id: salonId } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    const arrBuf = await audio.arrayBuffer();
    const buffer = Buffer.from(arrBuf);

    // ثبت رکورد تماس صوتی
    const voiceCall = await prisma.voiceCall.create({
      data: {
        salonId,
        audioUrl: null, // برای ذخیره واقعی از Blob استفاده کنید
        durationSec: Math.round(audio.size / 8000),
        status: "PROCESSING",
        extracted: { salonSlug: salon.slug, phone: userPhone } as never,
      },
    });

    if (transcribeAudio) {
      // شروع پردازش
      const { transcript, provider, durationSec } = await transcribeAudio(buffer, {
        filename: audio.name || "recording.webm",
        mimeType: audio.type,
      });

      const extracted = await extractAppointment(transcript);

      await prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          transcript,
          durationSec: durationSec,
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
    }

    return json({ success: true, voiceCallId: voiceCall.id, pending: true });
  } catch (err) {
    return apiError(err);
  }
}
