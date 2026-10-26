import { prisma } from "@/lib/prisma";
import { computeFreeSlots } from "@/lib/bookings/availability";
import { enqueueSms, processPendingNotifications } from "@/lib/notifications/queue";
import { json } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * Cron لیست انتظار هوشمند:
 * مشتریانی که زمان دلخواهشان پر بوده، هرگاه بازه آزادی برای همان خدمت/آرایشگر
 * ظاهر شود (مثلاً لغو نوبت)، اطلاع‌رسانی می‌شوند.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const waiting = await prisma.waitlistEntry.findMany({
    where: { status: "WAITING" },
    include: { salon: true },
    take: 100,
  });

  const today = new Date().toISOString().slice(0, 10);
  let notified = 0;

  for (const w of waiting) {
    if (!w.serviceId) continue;
    const service = await prisma.service.findUnique({ where: { id: w.serviceId } });
    if (!service || service.salonId !== w.salonId) continue;

    const slots = await computeFreeSlots({
      salon: w.salon,
      services: [service],
      employeeId: w.employeeId ?? undefined,
      dayISO: today,
    }).catch(() => []);

    if (slots.length > 0) {
      await prisma.waitlistEntry.update({ where: { id: w.id }, data: { status: "NOTIFIED", notifiedAt: new Date() } });
      await enqueueSms({
        type: "WAITLIST_FREED",
        recipient: w.customerPhone,
        message: `سلام ${w.customerName}، برای خدمت درخواستی شما در «${w.salon.name}» امروز زمانی آزاد شده است. برای رزرو اقدام کنید.`,
        uniqueKey: `waitlist:${w.id}`,
        salonId: w.salonId,
      });
      notified++;
    }
  }

  const result = await processPendingNotifications(20);

  return json({ success: true, scanned: waiting.length, notified, ...result });
}
