import { prisma } from "@/lib/prisma";
import type { Salon, Service, Staff, Appointment } from "@prisma/client";

export type Slot = { startAt: Date; endAt: Date };

const SLOT_STEP_MIN = 30;

function toMin(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

/** پنجره کاری سالن برای یک روز (دقیقه از نیمه‌شب) */
export async function getSalonWindow(salonId: string, dayISO: string): Promise<{ open: number; close: number }> {
  const date = new Date(dayISO + "T00:00:00");
  const day = date.getDay(); // 0=Sun ... 6=Sat
  const hour = await prisma.openingHour.findUnique({
    where: { salonId_dayOfWeek: { salonId, dayOfWeek: day } },
  });
  if (!hour || hour.isClosed) return { open: 0, close: 0 };
  const [oh, om] = hour.openTime.split(":").map(Number);
  const [ch, cm] = hour.closeTime.split(":").map(Number);
  return { open: oh * 60 + om, close: ch * 60 + cm };
}

/** پنجره کاری آرایشگر (اگر برنامه شخصی داشته باشد، وگرنه پنجره سالن) */
export async function getStaffWindow(salonId: string, staffId: string, dayISO: string) {
  const salonWindow = await getSalonWindow(salonId, dayISO);
  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  const schedule = (staff?.schedule as { day: number; open: string; close: string; isClosed?: boolean }[] | null) ?? null;
  const day = new Date(dayISO + "T00:00:00").getDay();
  const entry = schedule?.find((s) => s.day === day);
  if (!schedule || !entry) return salonWindow;
  if (entry.isClosed) return { open: 0, close: 0 };
  const [oh, om] = entry.open.split(":").map(Number);
  const [ch, cm] = entry.close.split(":").map(Number);
  return { open: oh * 60 + om, close: ch * 60 + cm };
}

/** بازه‌های اشغال (نوبت‌ها) در یک روز */
export async function getOccupiedIntervals(salonId: string, dayISO: string, employeeId?: string) {
  const start = new Date(dayISO + "T00:00:00");
  const end = new Date(dayISO + "T23:59:59.999");
  const where: any = {
    salonId,
    startAt: { gte: start, lt: end },
    status: { in: ["REQUESTED", "CONFIRMED"] },
  };
  if (employeeId) where.employeeId = employeeId;
  const rows = await prisma.appointment.findMany({ where, select: { startAt: true, endAt: true, employeeId: true } });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

/** بازه‌های مسدود (TimeBlock) در یک روز */
export async function getBlockedIntervals(salonId: string, dayISO: string, employeeId?: string) {
  const start = new Date(dayISO + "T00:00:00");
  const end = new Date(dayISO + "T23:59:59.999");
  const where: any = { salonId, startAt: { lt: end }, endAt: { gt: start } };
  if (employeeId) where.staffId = employeeId;
  const rows = await prisma.timeBlock.findMany({ where, select: { startAt: true, endAt: true } });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

function overlaps(a: { start: Date; end: Date }, b: { start: Date; end: Date }) {
  return a.start < b.end && a.end > b.start;
}

/**
 * محاسبه بازه‌های واقعاً آزاد برای یک خدمت در یک روز.
 * - مدت‌ زمان + بافر سالن
 * - محدود به پنجره کاری (سالن + آرایشگر)
 * - حذف تداخل با نوبت‌ها و بازه‌های مسدود
 * - رعایت حداقل فاصله تا رزرو و حداکثر بازه آینده
 */
export async function computeFreeSlots(params: {
  salon: Salon;
  service: Service;
  employeeId?: string;
  dayISO: string;
  now?: Date;
}): Promise<Slot[]> {
  const now = params.now ?? new Date();
  const { salon, service } = params;
  const duration = service.durationMin;
  const buffer = salon.bufferMinutes;

  const win = params.employeeId
    ? await getStaffWindow(salon.id, params.employeeId, params.dayISO)
    : await getSalonWindow(salon.id, params.dayISO);

  const occupied = await getOccupiedIntervals(salon.id, params.dayISO, params.employeeId);
  const blocked = await getBlockedIntervals(salon.id, params.dayISO, params.employeeId);

  // حداکثر بازه رزرو آینده
  const maxAdvance = new Date(now.getTime() + salon.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const minNotice = new Date(now.getTime() + salon.minNoticeMinutes * 60 * 1000);

  const dateStart = new Date(params.dayISO + "T00:00:00");
  const dayEnd = new Date(params.dayISO + "T23:59:59.999");

  const slots: Slot[] = [];
  for (let t = win.open; t + duration <= win.close; t += SLOT_STEP_MIN) {
    const start = new Date(dateStart.getTime() + t * 60 * 1000);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const serviceEnd = new Date(end.getTime() + buffer * 60 * 1000);

    if (start >= dayEnd) break;
    if (start < minNotice) continue;
    if (start > maxAdvance) continue;

    const candidate = { start, end: serviceEnd };
    const clashOccupied = occupied.some((o) => overlaps(candidate, o));
    const clashBlocked = blocked.some((b) => overlaps(candidate, b));
    if (clashOccupied || clashBlocked) continue;

    slots.push({ startAt: start, endAt: end });
  }

  return slots;
}
