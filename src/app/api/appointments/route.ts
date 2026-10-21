import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  salonId: z.string(),
  serviceId: z.string().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^0?9\d{9}$/),
  startAt: z.string().datetime(), // ISO
  durationMin: z.number().int().positive().optional(),
  channel: z.enum(["VOICE", "MANUAL", "WEBAPP"]).default("MANUAL"),
  voiceCallId: z.string().optional(),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    const salon = await prisma.salon.findUnique({ where: { id: body.salonId } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    const startAt = new Date(body.startAt);
    const duration = body.durationMin ?? (body.serviceId ? (await prisma.service.findUnique({ where: { id: body.serviceId } }))?.durationMin ?? 60 : 60);
    const endAt = new Date(startAt.getTime() + duration * 60 * 1000);

    // کنترل تداخل زمانی ساده
    const clash = await prisma.appointment.findFirst({
      where: {
        salonId: salon.id,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (clash) {
      return json({ success: false, error: "این بازه زمانی قبلاً رزرو شده است" }, { status: 409 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        salonId: salon.id,
        serviceId: body.serviceId,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        startAt,
        endAt,
        channel: body.channel,
        voiceCallId: body.voiceCallId,
        note: body.note,
      },
    });

    // ارسال پیامک تأیید
    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(startAt);
    try {
      await getSmsProvider().sendAppointmentReminder(body.customerPhone, salon.name, time);
    } catch {
      // اگر پیامک خطا داشت، خود نوبت ثبت شده است
    }

    return json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
