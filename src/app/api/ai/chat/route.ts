import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assistantReply } from "@/lib/ai/assistant";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  salonId: z.string(),
  question: z.string().min(1).max(1000),
  customerName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const salon = await prisma.salon.findUnique({ where: { id: body.salonId } });
    if (!salon) return json({ success: false, error: "سالن یافت نشد" }, { status: 404 });

    const { reply, usedAI } = await assistantReply(body.question, { salonId: body.salonId, customerName: body.customerName });
    return json({ success: true, reply, usedAI });
  } catch (err) {
    return apiError(err);
  }
}
