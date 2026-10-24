import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import DashboardShell from "@/components/DashboardShell";
import AccountPanel from "@/components/AccountPanel";

export const instant = false;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <DashboardShell role={user.role} title="حساب من">
      <div className="mx-auto max-w-4xl">
        <p className="mb-5 text-sm text-neutral-500 dark:text-neutral-400">
          نوبت‌ها، تاریخچه مراجعات، علاقه‌مندی‌ها، نظرات و امنیت حساب شما در یک‌جا.
        </p>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
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
        </div>
      </div>
    </DashboardShell>
  );
}
