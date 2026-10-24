import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { json, apiError } from "@/lib/utils";
import { createAppointmentSafe } from "@/lib/bookings/create";
import { serviceDuration } from "@/lib/bookings/service";
import { enqueueSms, processPendingNotifications } from "@/lib/notifications/queue";
import { renderSmsTemplate } from "@/lib/notifications/templates";

/** فهرست نوبت‌های سالنِ آرایشگر (یا همه برای ادمین) */
export async function GET(req: Request) {
  try {
    const user = await requireAuth();

    let where: any = { id: "" };
    if (user.role === "SALON_OWNER") {
      const salon = await prisma.salon.findUnique({ where: { ownerId: user.id }, select: { id: true } });
      where = salon ? { salonId: salon.id } : { id: "" };
    } else if (user.role === "AGENT") {
      const plans = await prisma.commissionPlan.findMany({ where: { agentId: user.id, isActive: true }, select: { salonId: true } });
      const salonIds = plans.map((p) => p.salonId);
      where = salonIds.length ? { salonId: { in: salonIds } } : { id: "" };
    } else if (user.role === "CUSTOMER") {
      where = { customerId: user.id };
    } else if (user.role === "ADMIN") {
      where = {};
    }

    // بازه زمانی اختیاری برای تقویم (روز/هفته/ماه)
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from || to) {
      where.startAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lt: new Date(to) } : {}),
      };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { name: true, price: true } },
        salon: { select: { name: true, slug: true } },
        employee: { select: { name: true } },
      },
      orderBy: { startAt: "desc" },
      take: from || to ? 2000 : 200,
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
  branchId: z.string().optional(),
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
      duration = services.reduce((sum, s) => sum + serviceDuration(s), 0);
      primaryServiceId = services[0].id;
      combinedNote = [body.note, services.map((s) => s.name).join("، ")].filter(Boolean).join(" — ");
    } else if (body.serviceId) {
      // مدت‌زمان همیشه از خود خدمت خوانده می‌شود، نه از ورودی کلاینت
      const service = await prisma.service.findFirst({ where: { id: body.serviceId, salonId: salon.id, isActive: true } });
      if (!service) return json({ success: false, error: "خدمت یافت نشد" }, { status: 404 });
      duration = service.durationMin;
      primaryServiceId = service.id;
    } else {
      // نوبت بدون خدمت (مثلاً مراجعه سرخود): مدت باید منطقی باشد
      const raw = body.durationMin ?? 60;
      if (raw < 5 || raw > 480) {
        return json({ success: false, error: "مدت نوبت باید بین ۵ تا ۴۸۰ دقیقه باشد" }, { status: 400 });
      }
      duration = raw;
    }

    // اعتبارسنجی تعلق کارمند و شعبه به همین سالن (جلوگیری از ثبت متقاطع)
    if (body.employeeId) {
      const staff = await prisma.staff.findUnique({ where: { id: body.employeeId }, select: { salonId: true } });
      if (!staff || staff.salonId !== salon.id) {
        return json({ success: false, error: "آرایشگر یافت نشد" }, { status: 400 });
      }
    }
    if (body.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: body.branchId }, select: { salonId: true } });
      if (!branch || branch.salonId !== salon.id) {
        return json({ success: false, error: "شعبه یافت نشد" }, { status: 400 });
      }
    }

    const user = await requireAuth().catch(() => null);

    // ثبت نوبت با محافظت از رزرو هم‌زمان (تراکنش + قفل)
    const appointment = await createAppointmentSafe({
      salonId: salon.id,
      serviceId: primaryServiceId,
      employeeId: body.employeeId,
      branchId: body.branchId,
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
    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short", timeZone: salon.timezone }).format(appointment.startAt);
    const confirmMsg = await renderSmsTemplate("sms.template.confirm", {
      salon: salon.name,
      customer: body.customerName,
      time,
      date: appointment.startAt.toLocaleDateString("fa-IR", { timeZone: salon.timezone }),
      code: appointment.id.slice(0, 8),
    });
    await enqueueSms({
      type: "APPOINTMENT_CONFIRM",
      recipient: body.customerPhone,
      message: confirmMsg,
      uniqueKey: `confirm:${appointment.id}`,
    });
    await processPendingNotifications(5).catch(() => {});

    return json({ success: true, appointment }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
