import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

/** مشاهده فاکتورها/پرداخت‌ها از پنل سوپرادمین */
export async function GET(req: Request) {
  try {
    await requireRole(["ADMIN"]);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const invoices = await prisma.invoice.findMany({
      where: status ? { status: status as never } : {},
      include: { salon: { select: { id: true, name: true, slug: true } } },
      orderBy: { issuedAt: "desc" },
      take: 500,
    });
    return json({ success: true, invoices });
  } catch (err) {
    return apiError(err);
  }
}