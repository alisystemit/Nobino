import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";

export const instant = false;

export default async function OldAdminRedirect() {
  await requireRole(["ADMIN"]);
  redirect("/admin");
}
