import { prisma } from "@/lib/prisma";

export class RescheduleConflictError extends Error {
  status = 409;
  constructor(message = "بازه جدید قابل رزرو نیست") {
    super(message);
  }
}

/** جابه‌جایی نوبت با محافظت از تداخل (تراکنش + قفل سالن) */
export async function rescheduleAppointmentSafe(appointmentId: string, newStartAt: Date) {
  return prisma.$transaction(async (tx) => {
    const prev = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { salon: true },
    });
    if (!prev) throw new Error("نوبت یافت نشد");

    await tx.$queryRaw`SELECT id FROM "Salon" WHERE id = ${prev.salonId}::text FOR UPDATE`;

    const duration = (prev.endAt.getTime() - prev.startAt.getTime()) / 60000;
    const buffer = prev.salon.bufferMinutes;
    const start = new Date(newStartAt);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const serviceEnd = new Date(end.getTime() + buffer * 60 * 1000);

    const where: any = {
      salonId: prev.salonId,
      status: { in: ["REQUESTED", "CONFIRMED"] },
      startAt: { lt: serviceEnd },
      endAt: { gt: start },
      id: { not: appointmentId },
    };
    if (prev.employeeId) where.employeeId = prev.employeeId;

    const clash = await tx.appointment.findFirst({ where });
    if (clash) throw new RescheduleConflictError();

    return tx.appointment.update({
      where: { id: appointmentId },
      data: { startAt: start, endAt: end },
    });
  });
}
