import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { dispatchWebhook } from "@/lib/webhooks";
import { enqueueSms } from "@/lib/notifications/queue";
import { credit } from "@/lib/financial/wallet";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  status: z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  cancelReason: z.string().optional(),
  depositPaid: z.boolean().optional(),
});

const LOYALTY_POINTS = 10;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // فقط آرایشگر (مالک سالن) یا ادمین می‌تواند وضعیت را تغییر دهد
    const user = await requireRole(["SALON_OWNER", "ADMIN", "AGENT"]);
    const { id } = await params;
    const body = schema.parse(await req.json());

    const prev = await prisma.appointment.findUnique({ where: { id }, include: { salon: { select: { id: true, name: true, ownerId: true } } } });
    if (!prev) return json({ success: false, error: "appointment not found" }, { status: 404 });
    if (user.role !== "ADMIN" && prev.salon.ownerId !== user.id) {
      return json({ success: false, error: "forbidden for this salon" }, { status: 403 });
    }

    const data: Record<string, unknown> = { status: body.status };
    if (body.cancelReason !== undefined) data.cancelReason = body.cancelReason;
    if (body.status === "CANCELLED") data.cancelledAt = new Date();
    if (body.depositPaid !== undefined) data.depositPaid = body.depositPaid;

    const appointment = await prisma.appointment.update({ where: { id }, data });

    // امتیاز وفاداری در صورت مراجعه واقعی
    if (body.status === "COMPLETED" && prev.customerId) {
      await prisma.user.update({ where: { id: prev.customerId }, data: { loyaltyPoints: { increment: LOYALTY_POINTS } } });
    }

    // کمیسیون آرایشگر (درصدی از قیمت خدمت) در صورت تکمیل
    if (body.status === "COMPLETED" && prev.employeeId && prev.serviceId) {
      const employee = await prisma.staff.findUnique({ where: { id: prev.employeeId } });
      const service = await prisma.service.findUnique({ where: { id: prev.serviceId } });
      if (employee && service && employee.commissionPercent > 0 && employee.userId) {
        const amount = Math.round((service.price * employee.commissionPercent) / 100);
        if (amount > 0) {
          await credit(employee.userId, amount, "COMMISSION_EARNING", {
            refType: "Appointment",
            refId: id,
            description: `کمیسیون ${employee.commissionPercent}٪ از «${service.name}»`,
          }).catch(() => {});
        }
      }
    }

    // وب‌هوک برای تأیید/لغو
    if (body.status === "CONFIRMED") {
      await dispatchWebhook(prev.salonId, "appointment.confirmed", { appointmentId: id, customerName: prev.customerName, startAt: prev.startAt });
    } else if (body.status === "CANCELLED") {
      await dispatchWebhook(prev.salonId, "appointment.cancelled", { appointmentId: id, customerName: prev.customerName, reason: body.cancelReason });
      await enqueueSms({
        type: "APPOINTMENT_CANCEL",
        recipient: prev.customerPhone,
        message: `نوبت شما در «${prev.salon.name}» لغو شد.`,
        uniqueKey: `cancel:${id}`,
      });
    }

    return json({ success: true, appointment });
  } catch (err) {
    return apiError(err);
  }
}
