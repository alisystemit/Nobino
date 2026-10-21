import { prisma } from "@/lib/prisma";
import { localMidnightUTC } from "@/lib/timezone";
import type { Salon, Service, Staff, Appointment } from "@prisma/client";

export type Slot = { startAt: Date; endAt: Date };

const SLOT_STEP_MIN = 30;

function toMin(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export async function getSalonWindow(salonId: string, dayISO: string): Promise<{ open: number; close: number }> {
  // تعطیلات استثنایی (Holiday)
  const dayStart = new Date(dayISO + "T00:00:00Z");
  const dayEnd = new Date(dayISO + "T23:59:59.999Z");
  const holiday = await prisma.holiday.findFirst({
    where: { salonId, date: { gte: dayStart, lte: dayEnd } },
  });
  if (holiday) {
    if (holiday.isClosed || !holiday.openTime || !holiday.closeTime) return { open: 0, close: 0 };
    const [oh, om] = holiday.openTime.split(":").map(Number);
    const [ch, cm] = holiday.closeTime.split(":").map(Number);
    return { open: oh * 60 + om, close: ch * 60 + cm };
  }

  const date = new Date(dayISO + "T00:00:00Z");
  const day = date.getUTCDay(); // 0=Sun ... 6=Sat
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
  const day = new Date(dayISO + "T00:00:00Z").getUTCDay();
  const entry = schedule?.find((s) => s.day === day);
  if (!schedule || !entry) return salonWindow;
  if (entry.isClosed) return { open: 0, close: 0 };
  const [oh, om] = entry.open.split(":").map(Number);
  const [ch, cm] = entry.close.split(":").map(Number);
  return { open: oh * 60 + om, close: ch * 60 + cm };
}

/** بازه‌های اشغال (نوبت‌ها) در یک روز */
export async function getOccupiedIntervals(salonId: string, dayISO: string, employeeId?: string, branchId?: string, timeZone: string = "Asia/Tehran") {
  const start = localMidnightUTC(dayISO, timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const where: any = {
    salonId,
    startAt: { gte: start, lt: end },
    status: { in: ["REQUESTED", "CONFIRMED"] },
  };
  // U,U?U,�?OU�OUO U.O�O3O_U^O_ O�O O3OU,U+ (employeeId = null) OO� U.O�O3O_U^O_ O�O O�O�OUOO'U_O� O�U.OU+ U.O3O_U^O_O3OO�UO U.O�O3O_U^O_ OO3O�.
  if (employeeId) {
    where.OR = [{ employeeId }, { employeeId: null }];
  }
  if (branchId) {
    const branchCond = { branchId };
    if (where.OR) where.OR.push(branchCond, { branchId: null });
    else where.OR = [branchCond, { branchId: null }];
  }
  const rows = await prisma.appointment.findMany({ where, select: { startAt: true, endAt: true, employeeId: true } });
  return rows.map((r) => ({ start: r.startAt, end: r.endAt }));
}

/** بازه‌های مسدود (TimeBlock) در یک روز */
export async function getBlockedIntervals(salonId: string, dayISO: string, employeeId?: string, branchId?: string, timeZone: string = "Asia/Tehran") {
  const start = localMidnightUTC(dayISO, timeZone);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const where: any = { salonId, startAt: { lt: end }, endAt: { gt: start } };
  if (employeeId) {
    where.OR = [{ staffId: employeeId }, { staffId: null }];
    delete where.staffId;
  }
  if (branchId) {
    const branchCond = { branchId };
    if (where.OR) where.OR.push(branchCond, { branchId: null });
    else where.OR = [branchCond, { branchId: null }];
  }
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
  branchId?: string;
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

  const tz = (salon as { timezone?: string }).timezone ?? "Asia/Tehran";
  const rawOccupied = await getOccupiedIntervals(salon.id, params.dayISO, params.employeeId, params.branchId, tz);
  const occupied = rawOccupied.map((o) => ({ start: o.start, end: new Date(o.end.getTime() + buffer * 60 * 1000) }));
  const blocked = await getBlockedIntervals(salon.id, params.dayISO, params.employeeId, params.branchId, tz);

  // حداکثر بازه رزرو آینده
  const maxAdvance = new Date(now.getTime() + salon.maxAdvanceDays * 24 * 60 * 60 * 1000);
  const minNotice = new Date(now.getTime() + salon.minNoticeMinutes * 60 * 1000);

  const dateStart = localMidnightUTC(params.dayISO, tz);
  const dayEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

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
