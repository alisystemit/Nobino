

import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { json, apiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const reviews = await prisma.review.findMany({
      include: { salon: { select: { name: true, slug: true } }, customer: { select: { name: true, phone: true } }, staff: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return json({ success: true, reviews });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireRole(["ADMIN"]);
    const { id } = await req.json();
    const before = await prisma.review.findUnique({ where: { id } });
    if (!before) return json({ success: false, error: "نظر یافت نشد" }, { status: 404 });
    await prisma.review.delete({ where: { id } });
    await logAudit({ actorId: user.id, actorPhone: user.phone, action: "delete_review", entityType: "Review", entityId: id, before: { rating: before.rating, salonId: before.salonId } });
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}

