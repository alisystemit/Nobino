import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { json, apiError } from "@/lib/utils";
import { createAppointmentSafe } from "@/lib/bookings/create";
import { enqueueSms, processPendingNotifications } from "@/lib/notifications/queue";

/** فهرست نوبت‌های سالنِ آرایشگر (یا همه برای ادمین) */
export async function GET() {
  try {
    const user = await requireAuth();

    let salonId: string | undefined;
    if (user.role === "SALON_OWNER") {
      const salon = await prisma.salon.findUnique({ where: { ownerId: user.id }, select: { id: true } });
      salonId = salon?.id;
    } else if (user.role === "CUSTOMER") {
      return json({ success: true, appointments: [] });
    }

    const appointments = await prisma.appointment.findMany({
      where: { ...(salonId ? { salonId } : {}) },
      include: {
        service: { select: { name: true, price: true } },
        salon: { select: { name: true } },
        employee: { select: { name: true } },
      },
      orderBy: { startAt: "desc" },
      take: 200,
    });

    return json({
      success: true,
      appointments: appointments.map((a) => ({
        id: a.id,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        startAt: a.startAt,
        endAt: a.endAt,
        status: a.status,
        channel: a.channel,
        service: a.service?.name,
        salonName: a.salon?.name,
        employee: a.employee?.name,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}

const schema = z.object({
  salonId: z.string(),
  serviceId: z.string().optional(),
  employeeId: z.string().optional(),
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

    const duration = body.durationMin ?? (body.serviceId ? (await prisma.service.findUnique({ where: { id: body.serviceId } }))?.durationMin ?? 60 : 60);

    const user = await requireAuth().catch(() => null);

    // ثبت نوبت با محافظت از رزرو هم‌زمان (تراکنش + قفل)
    const appointment = await createAppointmentSafe({
      salonId: salon.id,
      serviceId: body.serviceId,
      employeeId: body.employeeId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      startAt: new Date(body.startAt),
      durationMin: duration,
      channel: body.channel,
      voiceCallId: body.voiceCallId,
      note: body.note,
      customerId: user?.id ?? undefined,
    });

    // ارسال پیامک تأیید از طریق صف (با حذف تکراری و تلاش مجدد)
    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(appointment.startAt);
    await enqueueSms({
      type: "APPOINTMENT_CONFIRM",
      recipient: body.customerPhone,
      message: `نوبت شما در «${salon.name}» برای ساعت ${time} ثبت شد. (تأیید: ${appointment.id.slice(0, 8)})`,
      uniqueKey: `confirm:${appointment.id}`,
    });
    await processPendingNotifications(5).catch(() => {});

    return json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
