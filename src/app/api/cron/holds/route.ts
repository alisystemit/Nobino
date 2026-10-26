import { prisma } from "@/lib/prisma";
import { json } from "@/lib/utils";
import { HOLD_MARKER } from "@/lib/markers";

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/** پاک‌سازی قفل‌های موقت منقضی‌شده (آزادسازی بازه) */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const del = await prisma.appointment.deleteMany({
    where: { note: HOLD_MARKER, tempLockExpiresAt: { lt: new Date() } },
  });

  return json({ success: true, expiredCleared: del.count });
}
