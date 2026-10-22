import { prisma } from "@/lib/prisma";

/**
 * ثبت/به‌روزرسانی پروندهٔ مشتری پس از مراجعهٔ واقعی.
 * دفعات بازدید و هزینه‌کرد از روی نوبت‌های تکمیل‌شده محاسبه می‌شود.
 */
export async function syncCustomerProfile(params: {
  salonId: string;
  phone: string;
  name?: string | null;
  customerId?: string | null;
}) {
  const [appointments] = await Promise.all([
    prisma.appointment.findMany({
      where: { salonId: params.salonId, customerPhone: params.phone },
      select: { id: true, status: true, startAt: true, service: { select: { price: true } } },
    }),
  ]);

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const spend = completed.reduce((sum, a) => sum + (a.service?.price ?? 0), 0);
  const lastVisitAt = completed.length ? completed.reduce((latest, a) => (a.startAt > latest ? a.startAt : latest), completed[0].startAt) : null;

  return prisma.salonCustomer.upsert({
    where: { salonId_phone: { salonId: params.salonId, phone: params.phone } },
    create: {
      salonId: params.salonId,
      phone: params.phone,
      name: params.name ?? null,
      visits: completed.length,
      spend,
      lastVisitAt,
    },
    update: {
      name: params.name ?? undefined,
      visits: completed.length,
      spend,
      lastVisitAt,
    },
  });
}
