import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; holidayId: string }> }) {
  try {
    await requireRole(["SALON_OWNER", "ADMIN"]);
    const { holidayId } = await params;
    await prisma.holiday.delete({ where: { id: holidayId } });
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}