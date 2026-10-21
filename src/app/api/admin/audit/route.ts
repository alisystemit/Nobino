import { requireRole } from "@/lib/auth/guards";
import { getAuditLogs } from "@/lib/audit";
import { json, apiError } from "@/lib/utils";

export async function GET() {
  try {
    await requireRole(["ADMIN"]);
    const logs = await getAuditLogs(200);
    return json({ success: true, logs });
  } catch (err) {
    return apiError(err);
  }
}
