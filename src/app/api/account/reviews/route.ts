import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { json, apiError } from "@/lib/utils";

/** نظرات ثبت‌شده توسط کاربر جاری */
export async function GET() {
  try {
    const user = await requireAuth();
    const reviews = await prisma.review.findMany({
      where: { customerId: user.id },
      include: {
        salon: { select: { name: true, slug: true } },
        staff: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return json({
      success: true,
      reviews: reviews.map((r) => ({
        id: r.id,
        appointmentId: r.appointmentId,
        rating: r.rating,
        comment: r.comment,
        salonName: r.salon.name,
        salonSlug: r.salon.slug,
        staff: r.staff?.name ?? null,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
