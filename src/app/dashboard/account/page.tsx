import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import AccountPanel from "@/components/AccountPanel";
import { PanelCard } from "@/components/ui/Stats";

export const instant = false;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell role={user.role} title="حساب من">
      <div className="mx-auto max-w-5xl">
        <PanelCard
          title="پروفایل و تنظیمات حساب"
          subtitle="نوبت‌ها، تاریخچه مراجعات، علاقه‌مندی‌ها، نظرات و امنیت حساب شما در یک‌جا."
          icon={<UserRound className="h-5 w-5" />}
          bodyClassName="p-5"
        >
          <AccountPanel
            initialMe={{
              id: user.id,
              phone: user.phone,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
              role: user.role,
            }}
          />
        </PanelCard>
      </div>
    </DashboardShell>
  );
}
