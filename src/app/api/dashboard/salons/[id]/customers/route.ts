import { z } from "zod";
import { requireSalonManage } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { json, apiError } from "@/lib/utils";

const schema = z.object({
  phone: z.string().regex(/^0?9\d{9}$/),
  name: z.string().optional(),
  note: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
});

/** CRM: لیست مشتریان سالن با سوابق مراجعه، دفعات بازدید و هزینه‌کرد */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const url = new URL(_req.url);
    const q = url.searchParams.get("q")?.trim();

    const customers = await prisma.salonCustomer.findMany({
      where: q ? { salonId: id, OR: [{ phone: { contains: q } }, { name: { contains: q } }] } : { salonId: id },
      include: { notes: { orderBy: { createdAt: "desc" }, take: 20 } },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });

    return json({ success: true, customers });
  } catch (err) {
    return apiError(err);
  }
}

/** اضافه/به‌روزرسانی پروندهٔ مشتری (با یادداشت اختیاری) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireSalonManage(id);
    const body = schema.parse(await req.json());
    const phone = body.phone.startsWith("0") ? body.phone : `0${body.phone}`;

    const existing = await prisma.salonCustomer.findUnique({ where: { salonId_phone: { salonId: id, phone } } });
    if (existing && body.note) {
      await prisma.salonCustomerNote.create({ data: { customerId: existing.id, note: body.note } });
    }

    const customer = existing
      ? await prisma.salonCustomer.update({
          where: { id: existing.id },
          data: { name: body.name ?? existing.name, tags: body.tags ?? existing.tags, note: body.note ?? existing.note },
        })
      : await prisma.salonCustomer.create({
          data: {
            salonId: id,
            phone,
            name: body.name,
            note: body.note,
            tags: body.tags ?? [],
          },
        });

    return json({ success: true, customer }, { status: existing ? 200 : 201 });
  } catch (err) {
    return apiError(err);
  }
}