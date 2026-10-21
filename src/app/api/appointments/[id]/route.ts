import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guards";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  status: z.enum(["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // فقط آرایشگر (مالک سالن) یا ادمین می‌تواند وضعیت را تغییر دهد
    await requireRole(["SALON_OWNER", "ADMIN", "AGENT"]);
    const { id } = await params;
    const body = schema.parse(await req.json());

    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status: body.status },
    });

    return json({ success: true, appointment });
  } catch (err) {
    return apiError(err);
  }
}
