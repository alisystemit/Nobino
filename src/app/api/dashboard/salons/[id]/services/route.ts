import { z } from "zod";
import { requireSalonManage } from "@/lib/auth/guards";
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
    const { id } = await params;
    await requireSalonManage(id);
    const services = await prisma.service.findMany({ where: { salonId: id }, orderBy: { createdAt: "asc" } });
    return json({ success: true, services });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireSalonManage(id);

    const salon = await prisma.salon.findUnique({ where: { id } });
    if (!salon) return json({ success: false, error: "salon not found" }, { status: 404 });

    const body = createSchema.parse(await req.json());
    const service = await prisma.service.create({ data: { salonId: id, ...body } });
    return json({ success: true, service }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
