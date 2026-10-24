import { requireSalonManage } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

/** فاکتور/رسیدهای اشتراک سالن */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const invoices = await prisma.invoice.findMany({
      where: { salonId: id },
      include: { subscription: { include: { package: { select: { name: true } } } } },
      orderBy: { issuedAt: "desc" },
      take: 300,
    });
    return json({ success: true, invoices });
  } catch (err) {
    return apiError(err);
  }
}