import { requireRole } from "@/lib/auth/guards";
import { getCommissionSummary } from "@/lib/financial/summary";
import { json, apiError, formatToman } from "@/lib/utils";

export async function GET() {
  try {
    const user = await requireRole(["AGENT", "ADMIN"]);
    const summary = await getCommissionSummary(user.id);
    return json({
      success: true,
      summary: {
        balance: summary.balance,
        totalEarned: summary.totalEarned,
        activePlanCount: summary.activePlanCount,
        plans: summary.plans.map((p) => ({
          salonName: p.salon.name,
          slug: p.salon.slug,
          percent: p.percent,
        })),
        totalEarnedLabel: formatToman(summary.totalEarned),
        balanceLabel: formatToman(summary.balance),
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
