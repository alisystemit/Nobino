import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import AdminVoiceBooking from "@/components/AdminVoiceBooking";

export const instant = false;

export default async function VoiceBookingPage() {
  const user = await requireRole(["SALON_OWNER", "ADMIN"]);
  const salon = await prisma.salon.findFirst({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });
  if (!salon) redirect("/dashboard/salon");

  return (
    <DashboardShell role={user.role} title="رزرو صوتی">
      <div className="mx-auto max-w-5xl">
        <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-400">
          نوبت را با صدای فارسی ثبت کنید؛ سیستم گفتار را به متن تبدیل و فرم را پر می‌کند.
        </p>
        <AdminVoiceBooking salonId={salon.id} salonSlug={salon.slug} />
      </div>
    </DashboardShell>
  );
}
