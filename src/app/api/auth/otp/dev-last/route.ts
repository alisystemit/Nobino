import { prisma } from "@/lib/prisma";
import { json } from "@/lib/utils";

/**
 * نمایش کد OTP در محیط توسعه (فقط وقتی NODE_ENV !== 'production').
 * برای راحتی تست محلی؛ در پروداکشن این مسیر ناموجود است.
 */
export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return json({ success: false, error: "not available" }, { status: 404 });
  }
  const phone = new URL(req.url).searchParams.get("phone") ?? "";
  if (!phone) return json({ success: false, error: "phone required" }, { status: 400 });

  const record = await prisma.otp.findFirst({
    where: { phone, purpose: "LOGIN", usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { code: true, expiresAt: true },
  });

  if (!record) return json({ success: false, code: null });
  return json({ success: true, code: record.code, expiresAt: record.expiresAt });
}
