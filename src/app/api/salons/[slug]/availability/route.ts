import { prisma } from "@/lib/prisma";
import { computeFreeSlots } from "@/lib/bookings/availability";
import { json } from "@/lib/utils";

/**
 * محاسبه بازه‌های واقعاً آزاد برای یک خدمت در یک روز.
 * ?date=YYYY-MM-DD&serviceId=...&employeeId=...
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(_req.url);
  const dayISO = url.searchParams.get("date") ?? "";
  const serviceId = url.searchParams.get("serviceId") ?? "";
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const branchId = url.searchParams.get("branchId") ?? undefined;

  if (!dayISO || !/^\d{4}-\d{2}-\d{2}$/.test(dayISO)) {
    return json({ success: false, error: "پارامتر تاریخ (date=YYYY-MM-DD) الزامی است" }, { status: 400 });
  }
  if (!serviceId) {
    return json({ success: false, error: "serviceId الزامی است" }, { status: 400 });
  }

  const salon = await prisma.salon.findUnique({ where: { slug } });
  if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.salonId !== salon.id) {
    return json({ success: false, error: "خدمت یافت نشد" }, { status: 404 });
  }

  const slots = await computeFreeSlots({ salon, service, employeeId, branchId, dayISO });

  return json({
    success: true,
    day: dayISO,
    service: { id: service.id, name: service.name, durationMin: service.durationMin },
    slots: slots.map((s) => ({
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
    })),
  });
}
