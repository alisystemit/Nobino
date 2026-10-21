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

    const clashWhere: any = {
      salonId: prev.salonId,
      status: { in: ["REQUESTED", "CONFIRMED"] },
      startAt: { lt: serviceEnd },
      endAt: { gt: new Date(start.getTime() - buffer * 60 * 1000) },
      id: { not: appointmentId },
    };
    if (prev.employeeId) {
      clashWhere.OR = [{ employeeId: prev.employeeId }, { employeeId: null }];
    }

    const existing = await tx.appointment.findMany({ where: clashWhere });
    const candidateEffectiveEnd = new Date(end.getTime() + buffer * 60 * 1000);
    const clash = existing.find((a) => {
      const existingEffectiveEnd = new Date(a.endAt.getTime() + buffer * 60 * 1000);
      return start < existingEffectiveEnd && candidateEffectiveEnd > a.startAt;
    });
    if (clash) throw new RescheduleConflictError();

    // O�O_OOrU, O"O U.O3O_U^O_ (TimeBlock)
    const blockWhere: any = {
      salonId: prev.salonId,
      startAt: { lt: serviceEnd },
      endAt: { gt: start },
    };
    if (prev.employeeId) {
      blockWhere.OR = [{ staffId: prev.employeeId }, { staffId: null }];
    }
    const blockClash = await tx.timeBlock.findFirst({ where: blockWhere });
    if (blockClash) throw new RescheduleConflictError("time block conflict");

    // U,U^OU+UOU+ / O-O_OUcO�O� O"OO�U� O�UOU+O_U�
    if (start.getTime() < new Date().getTime() + prev.salon.minNoticeMinutes * 60 * 1000) {
      throw new RescheduleConflictError("min notice violation");
    }
    if (start.getTime() > new Date().getTime() + prev.salon.maxAdvanceDays * 86400 * 1000) {
      throw new RescheduleConflictError("max advance violation");
    }

    return tx.appointment.update({
      where: { id: appointmentId },
      data: { startAt: start, endAt: end },
    });
  });
}
