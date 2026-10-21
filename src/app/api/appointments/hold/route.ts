import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createAppointmentSafe } from "@/lib/bookings/create";
import { json, apiError } from "@/lib/utils";

const HOLD_MINUTES = 15;
const HOLD_MARKER = "__HOLD__";

const schema = z.object({
  salonId: z.string(),
  serviceId: z.string().optional(),
  employeeId: z.string().optional(),
  startAt: z.string().datetime(),
  durationMin: z.number().int().positive().optional(),
});

/** قفل موقت بازه هنگام پرداخت/تأیید (ضد رزرو هم‌زمان در لحظه خرید) */
export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());

    const salon = await prisma.salon.findUnique({ where: { id: body.salonId } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    let duration = body.durationMin;
    if (!duration && body.serviceId) {
      const svc = await prisma.service.findUnique({ where: { id: body.serviceId } });
      duration = svc?.durationMin;
    }
    duration = duration ?? 60;

    const appointment = await createAppointmentSafe({
      salonId: salon.id,
      serviceId: body.serviceId,
      employeeId: body.employeeId,
      customerName: "در انتظار پرداخت",
      customerPhone: "0000000000",
      startAt: new Date(body.startAt),
      durationMin: duration,
      channel: "WEBAPP",
      note: HOLD_MARKER,
    });

    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
    const held = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { tempLockExpiresAt: expiresAt },
    });

    return json({ success: true, holdId: held.id, expiresAt }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
