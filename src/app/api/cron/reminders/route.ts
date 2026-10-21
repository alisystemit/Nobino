import { prisma } from "@/lib/prisma";
import { enqueueSms, processPendingNotifications } from "@/lib/notifications/queue";
import { renderSmsTemplate } from "@/lib/notifications/templates";
import { json } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * Cron یادآوری نوبت (Vercel Cron - هر ساعت).
 * مشتریانی که نوبتشان تا کمتر از ۱ ساعت دیگر است و تأیید شده،
 * پیامک یادآوری برایشان در صف قرار می‌گیرد (با حذف تکراری).
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", startAt: { gte: now, lt: soon } },
    include: { salon: { select: { name: true } } },
  });

  let queued = 0;
  for (const a of appointments) {
    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(a.startAt);
    const msg = await renderSmsTemplate("sms.template.reminder", {
      salon: a.salon.name,
      customer: a.customerName,
      time,
      date: a.startAt.toLocaleDateString("fa-IR"),
    });
    await enqueueSms({
      type: "REMINDER",
      recipient: a.customerPhone,
      message: msg,
      uniqueKey: `reminder:${a.id}`,
    });
    queued++;
  }

  const result = await processPendingNotifications(20);

  return json({ success: true, candidates: appointments.length, queued, ...result });
}
