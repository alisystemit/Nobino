import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const createSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).min(1),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;
    const webhooks = await prisma.webhookConfig.findMany({ where: { salonId: id } });
    return json({ success: true, webhooks });
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
    const webhook = await prisma.webhookConfig.create({ data: { salonId: id, ...body } });
    return json({ success: true, webhook }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
