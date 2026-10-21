import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  durationMin: z.number().int().positive().optional(),
  price: z.number().int().min(0).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  try {
    const user = await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id, serviceId } = await params;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.salonId !== id) return json({ success: false, error: "خدمت یافت نشد" }, { status: 404 });
    if (user.role !== "ADMIN") {
      const salon = await prisma.salon.findUnique({ where: { id } });
      if (!salon || salon.ownerId !== user.id) return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const body = patchSchema.parse(await req.json());
    const updated = await prisma.service.update({ where: { id: serviceId }, data: body });
    return json({ success: true, service: updated });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; serviceId: string }> }) {
  try {
    const user = await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id, serviceId } = await params;

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || service.salonId !== id) return json({ success: false, error: "خدمت یافت نشد" }, { status: 404 });
    if (user.role !== "ADMIN") {
      const salon = await prisma.salon.findUnique({ where: { id } });
      if (!salon || salon.ownerId !== user.id) return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    await prisma.service.delete({ where: { id: serviceId } });
    return json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}
