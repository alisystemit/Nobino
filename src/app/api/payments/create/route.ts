import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { createPaymentForOrder } from "@/lib/payments/engine";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  packageId: z.string(),
  salonId: z.string().optional(),
  gateway: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = schema.parse(await req.json());

    const pkg = await prisma.package.findUnique({ where: { id: body.packageId } });
    if (!pkg || !pkg.isActive) return json({ success: false, error: "پکیج یافت نشد" }, { status: 404 });

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        salonId: body.salonId,
        packageId: pkg.id,
        amount: pkg.price,
        status: "PENDING",
      },
    });

    const { payment, gateway } = await createPaymentForOrder({ orderId: order.id, gateway: body.gateway });

    return json({
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      gateway,
      redirectUrl: payment.redirectUrl,
    }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
