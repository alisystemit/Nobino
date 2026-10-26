import DashboardShell from "@/components/DashboardShell";
import AppointmentsAgenda from "@/components/appointments/AppointmentsAgenda";
import { requirePageAuth } from "@/lib/auth/guards";
import { loadAgenda } from "@/lib/appointments/agenda";

// دادهٔ زندهٔ روز — رندر در زمان درخواست (کوکی + دیتابیس)
export const instant = false;

type SearchParams = Promise<{ date?: string; salon?: string }>;

/**
 * برنامهٔ روز نوبت‌ها.
 * صفحه سمت سرور رندر می‌شود تا روی گوشی بلافاصله محتوا دیده شود (بدون اسپینر
 * بارگیری) و تاریخ از `?date=` خوانده می‌شود؛ فیلتر و جستجو سمت کلاینت است.
 */
export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePageAuth();
  const sp = await searchParams;
  const agenda = await loadAgenda(user, { date: sp.date ?? null, salon: sp.salon ?? null });

  return (
    <DashboardShell role={user.role} title="نوبت‌ها">
      <AppointmentsAgenda
        items={agenda.rows}
        dayISO={agenda.dayISO}
        todayISO={agenda.todayISO}
        timezone={agenda.timezone}
        role={agenda.role}
        salons={agenda.salons}
        activeSalonId={agenda.activeSalonId}
      />
    </DashboardShell>
  );
}
