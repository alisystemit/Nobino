import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

/**
 * گزارش عملکرد سالن:
 * - نرخ مراجعه مجدد (مشتریان بازگشتی)
 * - نرخ لغو
 * - ساعات پرتقاضا (توزیع نوبت‌ها بر اساس ساعت)
 * - بهره‌وری کارکنان (تعداد نوبت انجام‌شده + درآمد هر کارمند)
 * - مشتریان جدید امروز
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;

    const [total, completed, cancelled, appointments, distinctCustomers, employees] = await Promise.all([
      prisma.appointment.count({ where: { salonId: id } }),
      prisma.appointment.count({ where: { salonId: id, status: "COMPLETED" } }),
      prisma.appointment.count({ where: { salonId: id, status: "CANCELLED" } }),
      prisma.appointment.findMany({
        where: { salonId: id },
        select: { startAt: true, status: true, customerPhone: true, employeeId: true, serviceId: true },
        take: 5000,
      }),
      prisma.appointment.groupBy({ by: ["customerPhone"], where: { salonId: id }, _count: { _all: true } }),
      prisma.staff.findMany({ where: { salonId: id }, select: { id: true, name: true } }),
    ]);

    // نرخ مراجعه مجدد: مشتریانی که بیش از یک نوبت داشته‌اند
    const repeat = distinctCustomers.filter((c) => c._count._all > 1).length;
    const returnRate = distinctCustomers.length ? Math.round((repeat / distinctCustomers.length) * 100) : 0;
    const cancelRate = total ? Math.round((cancelled / total) * 100) : 0;

    // ساعات پرتقاضا: توزیع نوبت‌ها بر اساس ساعت
    const hourCount: Record<number, number> = {};
    for (const a of appointments) {
      const h = a.startAt.getHours();
      hourCount[h] = (hourCount[h] ?? 0) + 1;
    }
    const peakHours = Object.entries(hourCount)
      .map(([h, count]) => ({ hour: Number(h), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // بهره‌وری کارکنان
    const staffPerformance = employees.map((emp) => {
      const empAppts = appointments.filter((a) => a.employeeId === emp.id);
      const done = empAppts.filter((a) => a.status === "COMPLETED").length;
      return { id: emp.id, name: emp.name, total: empAppts.length, completed: done };
    });

    // امروز
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const newToday = await prisma.appointment.count({ where: { salonId: id, createdAt: { gte: todayStart } } });

    return json({
      success: true,
      report: {
        total,
        completed,
        cancelled,
        cancelRate,
        distinctCustomers: distinctCustomers.length,
        repeatCustomers: repeat,
        returnRate,
        newCustomersToday: newToday,
        peakHours,
        staffPerformance,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
