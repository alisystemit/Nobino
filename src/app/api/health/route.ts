import { prisma } from "@/lib/prisma";
import { json } from "@/lib/utils";

/**
 * بازرسی سلامت برای PaaS (health check) و مانیتورینگ.
 * فقط وضعیت عمومی را برمی‌گرداند؛ هیچ داده یا secret ای در پاسخ نیست.
 */
export const instant = false;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, db: "up" });
  } catch {
    return json({ ok: false, db: "down" }, { status: 503 });
  }
}
