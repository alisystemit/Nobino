import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { enqueueSms } from "@/lib/notifications/queue";
import { dispatchWebhook } from "@/lib/webhooks";
import { json, apiError } from "@/lib/utils";

const schema = z.object({ reason: z.string().optional() });

/** لغو نوبت توسط خود مشتری (با رعایت قوانین سالن) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { salon: { select: { id: true, name: true, cancelDeadlineHours: true } } },
    });
    if (!appointment) return json({ success: false, error: "نوبت یافت نشد" }, { status: 404 });

    // مالکیت: فقط مشتری همان نوبت
    const isOwner =
      (appointment.customerId && appointment.customerId === user.id) ||
      appointment.customerPhone === user.phone;
    if (!isOwner && user.role !== "ADMIN") {
      return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    if (appointment.status === "COMPLETED" || appointment.status === "CANCELLED") {
      return json({ success: false, error: "این نوبت قابل لغو نیست" }, { status: 400 });
    }

    // قانون لغو: حداقل فاصله تا زمان نوبت
    const deadline = new Date(appointment.startAt.getTime() - appointment.salon.cancelDeadlineHours * 3600 * 1000);
    if (new Date() > deadline && user.role !== "ADMIN") {
      return json({ success: false, error: `طبق قوانین سالن، فقط تا ${appointment.salon.cancelDeadlineHours} ساعت قبل از نوبت می‌توانید لغو کنید.` }, { status: 400 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "CANCELLED", cancelReason: body.reason, cancelledAt: new Date() },
    });

    await enqueueSms({
      type: "APPOINTMENT_CANCEL",
      recipient: appointment.customerPhone,
      message: `نوبت شما در «${appointment.salon.name}» لغو شد.${body.reason ? ` دلیل: ${body.reason}` : ""}`,
      uniqueKey: `cancel:${id}`,
    });
    await dispatchWebhook(appointment.salonId, "appointment.cancelled", { appointmentId: id, customerName: appointment.customerName, reason: body.reason });

    return json({ success: true, appointment: updated });
  } catch (err) {
    return apiError(err);
  }
}
