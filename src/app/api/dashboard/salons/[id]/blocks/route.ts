import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const createSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().optional(),
  staffId: z.string().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SALON_OWNER", "ADMIN"]);
    const { id } = await params;
    const blocks = await prisma.timeBlock.findMany({
      where: { salonId: id },
      include: { staff: { select: { name: true } } },
      orderBy: { startAt: "asc" },
    });
    return json({ success: true, blocks });
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
    const start = new Date(body.startAt);
    const end = new Date(body.endAt);
    if (end <= start) return json({ success: false, error: "زمان پایان باید بعد از شروع باشد" }, { status: 400 });

    const block = await prisma.timeBlock.create({
      data: { salonId: id, startAt: start, endAt: end, reason: body.reason, staffId: body.staffId },
    });
    return json({ success: true, block }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
