import { prisma } from "@/lib/prisma";
import { getSmsProvider } from "@/lib/sms/provider";
import { json } from "@/lib/utils";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * Cron برای ارسال پیامک یادآوری.
 * با Vercel Cron زمان‌بندی می‌شود (به vercel.json مراجعه کنید).
 * فقط مشتری‌هایی که نوبتشان تا کمتر از ۱ ساعت دیگر است و تأیید شده، پیامک می‌گیرند.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000); // ۱ ساعت بعد

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      startAt: { gte: now, lt: soon },
    },
    include: { salon: { select: { name: true } } },
  });

  let sent = 0;
  for (const a of appointments) {
    const time = new Intl.DateTimeFormat("fa-IR", { timeStyle: "short" }).format(a.startAt);
    try {
      await (await getSmsProvider()).sendAppointmentReminder(a.customerPhone, a.salon.name, time);
      sent++;
    } catch {
      // خطای پیامک را نادیده بگیر تا بقیه ارسال شوند
    }
  }

  return json({ success: true, candidates: appointments.length, sent });
}
