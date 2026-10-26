import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";

export const instant = false;

export default async function OldAdminRedirect() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/dashboard");
  redirect("/admin");
}
