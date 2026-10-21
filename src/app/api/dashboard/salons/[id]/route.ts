import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  coverColor: z.string().optional(),
  timezone: z.string().optional(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  customDomain: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  minNoticeMinutes: z.number().int().min(0).optional(),
  maxAdvanceDays: z.number().int().min(1).optional(),
  cancelDeadlineHours: z.number().int().min(0).optional(),
  bufferMinutes: z.number().int().min(0).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });
    if (user.role !== "ADMIN" && salon.ownerId !== user.id) {
      return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const updated = await prisma.salon.update({ where: { id }, data: body });
    return json({ success: true, salon: updated });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;

    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });
    if (user.role !== "ADMIN" && salon.ownerId !== user.id) {
      return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await prisma.salon.delete({ where: { id } });
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}
