import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { enqueueSms } from "@/lib/notifications/queue";
import { dispatchWebhook } from "@/lib/webhooks";
import { json, apiError } from "@/lib/utils";

export const HOLD_MARKER = "__HOLD__";

const schema = z.object({
  appointmentId: z.string(),
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^0?9\d{9}$/),
});

/** تبدیل قفل موقت به نوبت قطعی (پس از پرداخت/تأیید مشتری) */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const phone = body.customerPhone.startsWith("0") ? body.customerPhone : `0${body.customerPhone}`;

    const appointment = await prisma.appointment.findUnique({
      where: { id: body.appointmentId },
      include: { salon: { select: { name: true, id: true, timezone: true } } },
    });
    if (!appointment) return json({ success: false, error: "نوبت یافت نشد" }, { status: 404 });
    if (!appointment.tempLockExpiresAt || appointment.tempLockExpiresAt < new Date()) {
      return json({ success: false, error: "قفل موقت منقضی شده است؛ دوباره تلاش کنید" }, { status: 410 });
    }

    const confirmed = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { customerName: body.customerName, customerPhone: phone, tempLockExpiresAt: null, note: null, status: "REQUESTED" },
    });

    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short", timeZone: appointment.salon.timezone }).format(confirmed.startAt);
    await enqueueSms({
      type: "APPOINTMENT_CONFIRM",
      recipient: phone,
      message: `نوبت شما در «${appointment.salon.name}» برای ساعت ${time} ثبت شد. (تأیید: ${confirmed.id.slice(0, 8)})`,
      uniqueKey: `confirm:${confirmed.id}`,
    });
    await dispatchWebhook(appointment.salonId, "appointment.confirmed", { appointmentId: confirmed.id, customerName: body.customerName, startAt: confirmed.startAt });

    return json({ success: true, appointment: confirmed });
  } catch (err) {
    return apiError(err);
  }
}
