import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1),
  durationMin: z.number().int().positive(),
  price: z.number().int().min(0),
  description: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;
    const services = await prisma.service.findMany({ where: { salonId: id }, orderBy: { createdAt: "asc" } });
    return json({ success: true, services });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;

    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });
    if (user.role !== "ADMIN" && salon.ownerId !== user.id) {
      return json({ success: false, error: "دسترسی غیرمجاز" }, { status: 403 });
    }

    const body = createSchema.parse(await req.json());
    const service = await prisma.service.create({ data: { salonId: id, ...body } });
    return json({ success: true, service }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
