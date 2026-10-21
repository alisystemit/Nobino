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

    let where: any = {};
    if (user.role === "SALON_OWNER") {
      const salon = await prisma.salon.findUnique({ where: { ownerId: user.id }, select: { id: true } });
      where = salon ? { salonId: salon.id } : {};
    } else if (user.role === "CUSTOMER") {
      where = { customerId: user.id };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { name: true, price: true } },
        salon: { select: { name: true, slug: true } },
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
        salonSlug: a.salon?.slug,
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
  serviceIds: z.array(z.string()).max(8).optional(), // رزرو چند خدمت
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

    // رزرو چند خدمت: مجموع زمان خدمت‌ها
    let primaryServiceId = body.serviceId;
    let duration = body.durationMin ?? 60;
    let combinedNote = body.note;
    if (body.serviceIds && body.serviceIds.length > 0) {
      const services = await prisma.service.findMany({ where: { id: { in: body.serviceIds }, salonId: salon.id } });
      if (services.length !== body.serviceIds.length) {
        return json({ success: false, error: "یکی از خدمت‌ها یافت نشد" }, { status: 400 });
      }
      duration = services.reduce((sum, s) => sum + s.durationMin, 0);
      primaryServiceId = services[0].id;
      combinedNote = [body.note, services.map((s) => s.name).join("، ")].filter(Boolean).join(" — ");
    }

    const user = await requireAuth().catch(() => null);

    // ثبت نوبت با محافظت از رزرو هم‌زمان (تراکنش + قفل)
    const appointment = await createAppointmentSafe({
      salonId: salon.id,
      serviceId: primaryServiceId,
      employeeId: body.employeeId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      startAt: new Date(body.startAt),
      durationMin: duration,
      channel: body.channel,
      voiceCallId: body.voiceCallId,
      note: combinedNote,
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
